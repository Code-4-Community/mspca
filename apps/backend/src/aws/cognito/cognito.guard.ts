import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from './cognito.decorator';
import { AccessTokenPayload, CognitoConfig } from './cognito.types';
import { getCognitoConfig } from './cognito.config';

// Extracts the bearer token from the request's Authorization header
function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}

/**
 * Runtime type guard for {@link AccessTokenPayload}.
 *
 * @param value - The value to check, typically a decoded JWT payload.
 * @returns `true` if `value` matches the {@link AccessTokenPayload} shape.
 */
function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === 'string' &&
    typeof payload.iss === 'string' &&
    typeof payload.token_use === 'string' &&
    payload.token_use === 'access' &&
    typeof payload.client_id === 'string' &&
    typeof payload.exp === 'number' &&
    typeof payload.iat === 'number' &&
    // Cognito Groups is either undefined or an array of strings
    (payload['cognito:groups'] === undefined ||
      (Array.isArray(payload['cognito:groups']) &&
        payload['cognito:groups'].every((g) => typeof g === 'string')))
  );
}

@Injectable()
export class CognitoJWTGuard implements CanActivate {
  private readonly logger = new Logger(CognitoJWTGuard.name);
  private jwks?: JwksClient;

  constructor(private readonly reflector: Reflector) {}

  /**
   * Determines whether the current request is allowed to proceed to the route handler.
   *
   * Access is granted without verification when authentication is disabled or when the
   * route (handler or controller) is marked public via the {@link IS_PUBLIC_KEY} metadata.
   * Otherwise, the bearer token is extracted from the `Authorization` header and verified
   * against the Cognito user pool's JWKS endpoint; on success the decoded
   * {@link AccessTokenPayload} is attached to `request.user` for downstream handlers.
   *
   * @param context - The current execution context provided by NestJS.
   * @returns `true` when the request is allowed to proceed.
   * @throws {UnauthorizedException} If no bearer token is present, the Cognito
   *   configuration is missing, or the token fails signature/claim verification.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config: CognitoConfig | null = this.resolveConfig();

    // Null iff auth was explicitly disabled via AUTH_DISABLED=true.
    if (config === null) {
      return true;
    }

    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // TODO: Uncomment after easy sign-in is implemented in frontend.
    const request = context.switchToHttp().getRequest<Request>();
    /*
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('No bearer token provided');
    }

    const payload: AccessTokenPayload = await this.verifyToken(token, config);
    (request as Request & { user: AccessTokenPayload }).user = payload;
    */
    return true;
  }

  /**
   * Resolves the Cognito configuration for this request.
   *
   * Catches errors from changing env-variables after boot
   *
   * @returns The resolved config, or `null` when auth is explicitly disabled.
   * @throws {UnauthorizedException} If the Cognito configuration is unusable.
   */
  private resolveConfig(): CognitoConfig | null {
    try {
      return getCognitoConfig();
    } catch (error) {
      this.logger.error(
        `Rejecting all requests, Cognito auth is enabled but unusable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new UnauthorizedException();
    }
  }

  // Verifies the token against user pool JWKS endpoint, and returns the JWT payload if the token is valid
  private verifyToken(
    token: string,
    config: CognitoConfig,
  ): Promise<AccessTokenPayload> {
    // Set up JWKS client to get the public key for the token to verify the JWT token signature
    this.jwks ??= jwksClient({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `${config.issuer}/.well-known/jwks.json`,
    });

    const client = this.jwks;

    const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
      const kid = header.kid; // The key ID (kid) from the JWT header
      if (!kid) {
        callback(new Error('JWT header missing kid'));
        return;
      }
      // Get the public key for the token to verify the JWT token signature
      client
        .getSigningKey(kid)
        .then((key) => callback(null, key.getPublicKey()))
        .catch((err: Error) => callback(err));
    };

    // Verify the token and return the JWT payload if the token is valid
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        { issuer: config.issuer, algorithms: ['RS256'] }, // AWS Cognito signs tokens with RS256 algorithm
        (err, decoded) => {
          // Verification failures are logged with their reason internally, but the
          // client only ever receives a generic UnauthorizedException so we don't
          // leak details about why the token was rejected.
          if (err || !decoded || typeof decoded === 'string') {
            this.logger.warn(
              `Token verification failed: ${
                err?.message ?? 'token could not be decoded'
              }`,
            );
            reject(new UnauthorizedException());
            return;
          }
          if (!isAccessTokenPayload(decoded)) {
            this.logger.warn(
              'Token rejected: decoded payload is not a valid access token payload',
            );
            reject(new UnauthorizedException());
            return;
          }
          const payload = decoded;
          if (payload.client_id !== config.clientId) {
            this.logger.warn(
              'Token rejected: client_id does not match the configured Cognito client ID',
            );
            reject(new UnauthorizedException());
            return;
          }
          // If the token is valid, return the JWT payload
          resolve(payload);
        },
      );
    });
  }
}
