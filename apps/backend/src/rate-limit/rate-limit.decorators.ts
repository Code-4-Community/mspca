import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PROTECTED_THROTTLER, PUBLIC_THROTTLER } from './rate-limit.utils';

/**
 * A custom rate limit for a route or controller.
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. Must be a positive integer. */
  limit: number;
  /** Window length in milliseconds. Must be a positive integer; use the minutes()/seconds() helpers from @nestjs/throttler. */
  ttl: number;
}

/**
 * Checks that a @RateLimit() option is a positive integer. Throws a plain Error
 * so an invalid value stops the app at startup rather than at request time.
 *
 * @param name - The option being checked, used in the error message.
 * @param value - The value to check.
 * @throws {Error} If `value` is not a positive integer.
 */
function assertPositiveInteger(
  name: keyof RateLimitOptions,
  value: number,
): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `@RateLimit(): ${name} must be a positive integer, received ${String(
        value,
      )}`,
    );
  }
}

/**
 * Overrides the default rate limit for a route or controller. Applies to
 * whichever throttler the route uses, so it works the same on @Public() and
 * protected routes. Requests over the limit receive 429 Too Many Requests.
 *
 * @param options - The limit and the window (ttl) to apply.
 * @returns A decorator that applies the limit to both throttlers.
 * @throws {Error} At startup, if `limit` or `ttl` is not a positive integer.
 *
 * @example
 * @RateLimit({ limit: 3, ttl: minutes(10) })
 */
export const RateLimit = ({
  limit,
  ttl,
}: RateLimitOptions): MethodDecorator & ClassDecorator => {
  assertPositiveInteger('limit', limit);
  assertPositiveInteger('ttl', ttl);

  return Throttle({
    [PUBLIC_THROTTLER]: { limit, ttl },
    [PROTECTED_THROTTLER]: { limit, ttl },
  });
};

/**
 * Turns off rate limiting for a route or controller. Use this instead of the
 * package's bare @SkipThrottle(), which skips nothing when throttlers are named.
 *
 * @returns A decorator that skips both throttlers.
 */
export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SkipThrottle({ [PUBLIC_THROTTLER]: true, [PROTECTED_THROTTLER]: true });
