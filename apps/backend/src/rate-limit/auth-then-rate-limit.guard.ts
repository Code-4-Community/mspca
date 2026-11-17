import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CognitoJWTGuard } from '../aws/cognito/cognito.guard';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * The app's single global guard: runs CognitoJWTGuard, then RateLimitGuard.
 *
 * The order matters. RateLimitGuard counts logged-in users by request.user,
 * which only exists after CognitoJWTGuard has verified the token. Registering
 * the two as separate global guards did not keep that order in practice (rate
 * limiting ran first), so this guard calls them explicitly, one after the other.
 */
@Injectable()
export class AuthThenRateLimitGuard implements CanActivate {
  constructor(
    private readonly authGuard: CognitoJWTGuard,
    private readonly rateLimitGuard: RateLimitGuard,
  ) {}

  /**
   * Runs authentication, then rate limiting if authentication succeeds. A
   * request that fails authentication never counts against anyone's limit.
   *
   * @param context - The execution context of the current request.
   * @returns `true` when the request passes both guards, or `false` if the auth guard denies it.
   * @throws {UnauthorizedException} If authentication fails; rate limiting is skipped.
   * @throws {ThrottlerException} If the request is over its rate limit (429).
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await this.authGuard.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }
    return this.rateLimitGuard.canActivate(context);
  }
}
