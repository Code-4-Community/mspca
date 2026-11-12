import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

// Metadata key to state that the route is PUBLIC and thus NOT PROTECTED by authentication (Cognito JWT Guard)
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Per-route rate limit for a public route, applied per client IP.
 */
export interface PublicThrottleOptions {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. Use the minutes()/seconds() helpers from @nestjs/throttler. */
  ttl: number;
}

/**
 * Marks a route (or controller) as public and rate limits it.
 *
 * Public routes skip Cognito authentication, so they are rate limited per IP to
 * prevent spam. Without an argument, the default limit from ThrottlerModule in
 * AppModule applies. Exceeding the limit returns 429 Too Many Requests.
 *
 * @example
 * @Public({ limit: 3, ttl: minutes(10) })
 */
export const Public = (throttle?: PublicThrottleOptions) =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    UseGuards(ThrottlerGuard),
    ...(throttle ? [Throttle({ default: throttle })] : []),
  );
