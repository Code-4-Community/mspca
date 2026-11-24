import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { CognitoJWTGuard } from '../aws/cognito/cognito.guard';
import { AuthThenRateLimitGuard } from './auth-then-rate-limit.guard';
import { RateLimitGuard } from './rate-limit.guard';

// jwks-rsa's ESM dependency can't be parsed by Jest, so it's stubbed (as in cognito.module.spec.ts).
jest.mock('jwks-rsa', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const context = {} as ExecutionContext;

describe('AuthThenRateLimitGuard', () => {
  let authGuard: { canActivate: jest.Mock };
  let rateLimitGuard: { canActivate: jest.Mock };
  let guard: AuthThenRateLimitGuard;

  beforeEach(() => {
    authGuard = { canActivate: jest.fn() };
    rateLimitGuard = { canActivate: jest.fn() };
    guard = new AuthThenRateLimitGuard(
      authGuard as unknown as CognitoJWTGuard,
      rateLimitGuard as unknown as RateLimitGuard,
    );
  });

  it('runs authentication before rate limiting and allows the request', async () => {
    authGuard.canActivate.mockResolvedValue(true);
    rateLimitGuard.canActivate.mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(authGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(authGuard.canActivate).toHaveBeenCalledWith(context);
    expect(rateLimitGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(rateLimitGuard.canActivate).toHaveBeenCalledWith(context);
    expect(authGuard.canActivate.mock.invocationCallOrder[0]).toBeLessThan(
      rateLimitGuard.canActivate.mock.invocationCallOrder[0],
    );
  });

  it('counts a failed authentication against the rate limit, then rethrows the authentication error', async () => {
    const error = new UnauthorizedException('No bearer token provided');
    authGuard.canActivate.mockRejectedValue(error);
    rateLimitGuard.canActivate.mockResolvedValue(true);

    await expect(guard.canActivate(context)).rejects.toBe(error);

    expect(authGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(rateLimitGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(rateLimitGuard.canActivate).toHaveBeenCalledWith(context);
  });

  it('rejects with 429 when a failed authentication is over the rate limit', async () => {
    const throttlerError = new ThrottlerException();
    authGuard.canActivate.mockRejectedValue(
      new UnauthorizedException('No bearer token provided'),
    );
    rateLimitGuard.canActivate.mockRejectedValue(throttlerError);

    await expect(guard.canActivate(context)).rejects.toBe(throttlerError);

    expect(authGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(rateLimitGuard.canActivate).toHaveBeenCalledTimes(1);
  });

  it('rejects when an authenticated request is over the rate limit', async () => {
    const error = new ThrottlerException();
    authGuard.canActivate.mockResolvedValue(true);
    rateLimitGuard.canActivate.mockRejectedValue(error);

    await expect(guard.canActivate(context)).rejects.toBe(error);

    expect(authGuard.canActivate).toHaveBeenCalledTimes(1);
    expect(rateLimitGuard.canActivate).toHaveBeenCalledTimes(1);
  });
});
