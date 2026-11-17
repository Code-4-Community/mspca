import { Injectable } from '@nestjs/common';
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
 * Must run after CognitoJWTGuard so request.user is already set; see CognitoModule.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  /**
   * Picks the key a request is counted under.
   *
   * @param req - The incoming request. `user` is set by CognitoJWTGuard on verified protected requests.
   * @returns `user:<sub>` for a logged-in user, otherwise `ip:<address>`.
   */
  protected async getTracker(
    req: Request & { user?: AccessTokenPayload },
  ): Promise<string> {
    const userId = req.user?.sub;
    if (userId) {
      return `user:${userId}`;
    }
    return `ip:${req.ip ?? 'unknown'}`;
  }
}
