import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  PROTECTED_THROTTLER,
  PUBLIC_THROTTLER,
  assertPositiveInteger,
  assertPositiveNumber,
} from './rate-limit.utils';

/**
 * A custom rate limit for a route or controller.
 */
export interface RateLimitOptions {
  limit: number;
  ttl: number;
}

/**
 * Overrides the default rate limit for a route or controller. Applies to
 * whichever throttler the route uses, so it works the same on @Public() and
 * protected routes. Requests over the limit receive 429 Too Many Requests.
 *
 * @param options - `limit` is the maximum number of requests in the window, as a
 *   positive integer. `ttl` is the window length in milliseconds, as a positive
 *   number; use the minutes()/seconds() helpers from @nestjs/throttler.
 * @returns A decorator that applies the limit to both throttlers.
 * @throws {Error} At startup, if `limit` is not a positive integer or `ttl` is not a positive number.
 *
 * @example
 * @RateLimit({ limit: 3, ttl: minutes(10) })
 */
export const RateLimit = (
  options: RateLimitOptions,
): MethodDecorator & ClassDecorator => {
  assertPositiveInteger('limit', options.limit);
  assertPositiveNumber('ttl', options.ttl);

  return Throttle({
    [PUBLIC_THROTTLER]: { limit: options.limit, ttl: options.ttl },
    [PROTECTED_THROTTLER]: { limit: options.limit, ttl: options.ttl },
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
