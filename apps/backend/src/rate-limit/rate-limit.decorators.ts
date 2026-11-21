import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
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
 * Overrides the default rate limit for a route or controller, on @Public() and
 * protected routes alike. Requests over the limit receive 429 Too Many Requests.
 *
 * @param options - `limit` is the maximum number of requests in the window, as a
 *   positive integer. `ttl` is the window length in milliseconds, as a positive
 *   number; use the minutes()/seconds() helpers from @nestjs/throttler.
 * @returns A decorator that overrides the default throttler's limit and ttl.
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

  return Throttle({ default: { limit: options.limit, ttl: options.ttl } });
};

/**
 * Turns off rate limiting for a route or controller.
 *
 * @returns A decorator that skips the default throttler.
 */
export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SkipThrottle({ default: true });
