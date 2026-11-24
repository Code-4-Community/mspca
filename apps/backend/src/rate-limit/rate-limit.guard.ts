import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AccessTokenPayload } from '../aws/cognito/cognito.types';

/**
 * Global rate limiting guard.
 *
 * Extends ThrottlerGuard to choose who each request is counted against:
 * - a logged-in user (request.user set by CognitoJWTGuard) is counted by their
 *   Cognito user ID (`sub`), so people sharing a network don't share a limit
 * - everyone else is counted by IP address. This covers public routes, where
 *   CognitoJWTGuard never sets request.user, and local development with
 *   AUTH_DISABLED=true
 *
 * Must run after CognitoJWTGuard so request.user is already set; see AuthThenRateLimitGuard.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly trackerLogger = new Logger(RateLimitGuard.name);

  /**
   * Picks the key a request is counted under.
   *
   * A request with no user and no IP address is counted under the shared key
   * `ip:unknown`, so every such request shares one limit and they can block each
   * other. This shouldn't happen behind a correctly configured server, so it's
   * logged as a warning.
   *
   * @param req - The incoming request. `user` is set by CognitoJWTGuard on verified protected requests.
   * @returns `user:<sub>` for a logged-in user, `ip:<address>` otherwise, or `ip:unknown` when the IP is missing.
   */
  protected async getTracker(
    req: Request & { user?: AccessTokenPayload },
  ): Promise<string> {
    const userId = req.user?.sub;
    if (userId) {
      return `user:${userId}`;
    }
    if (!req.ip) {
      this.trackerLogger.warn(
        'Request has no IP address, so it is rate limited under the shared key "ip:unknown"',
      );
      return 'ip:unknown';
    }
    return `ip:${req.ip}`;
  }
}
