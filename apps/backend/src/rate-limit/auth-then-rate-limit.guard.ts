import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CognitoJWTGuard } from '../aws/cognito/cognito.guard';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * The app's single global guard: runs CognitoJWTGuard, then RateLimitGuard.
 *
 * Authentication runs first because RateLimitGuard counts logged-in users by
 * request.user, which only exists after CognitoJWTGuard has verified the token.
 * Registering the two as separate global guards did not keep that order in
 * practice (rate limiting ran first), so this guard calls them explicitly.
 */
@Injectable()
export class AuthThenRateLimitGuard implements CanActivate {
  constructor(
    private readonly authGuard: CognitoJWTGuard,
    private readonly rateLimitGuard: RateLimitGuard,
  ) {}

  /**
   * Runs authentication, then rate limiting.
   *
   * A request that fails authentication is still counted against the rate
   * limit, by IP address, before the authentication error is rethrown. So
   * unauthenticated spam gets 429 once it's over the limit, while logged-in
   * users keep their own per-user counter.
   *
   * @param context - The execution context of the current request.
   * @returns `true` when the request passes both guards.
   * @throws {UnauthorizedException} If authentication fails and the IP address is still under its limit.
   * @throws {ThrottlerException} If the request is over its rate limit (429), including failed authentication attempts.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await this.authGuard.canActivate(context);
    } catch (error) {
      await this.rateLimitGuard.canActivate(context);
      throw error;
    }
    return await this.rateLimitGuard.canActivate(context);
  }
}
