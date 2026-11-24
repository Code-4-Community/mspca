import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerOptions, minutes } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '../aws/cognito/cognito.decorator';

/** Default requests per minute for @Public() routes, counted per IP address. */
export const PUBLIC_DEFAULT_LIMIT = 10;

/** Default requests per minute for protected routes, counted per Cognito user. */
export const PROTECTED_DEFAULT_LIMIT = 100;

const reflector = new Reflector();

/**
 * Checks whether a route is marked with @Public(), either on the handler or on
 * its controller, using the same lookup as CognitoJWTGuard.
 *
 * @param context - The execution context of the current request.
 * @returns `true` if the handler or its controller is marked public.
 */
export function isPublicRoute(context: ExecutionContext): boolean {
  const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  return isPublic === true;
}

/**
 * Default rate limit, passed to ThrottlerModule.forRoot() in CognitoModule.
 *
 * A single throttler whose limit depends on the route type: PUBLIC_DEFAULT_LIMIT
 * per minute for @Public() routes, and PROTECTED_DEFAULT_LIMIT per minute for
 * protected routes. Override per route with @RateLimit(), or opt out with
 * @SkipRateLimit().
 */
export const DEFAULT_THROTTLERS: ThrottlerOptions[] = [
  {
    ttl: minutes(1),
    limit: (context) =>
      isPublicRoute(context) ? PUBLIC_DEFAULT_LIMIT : PROTECTED_DEFAULT_LIMIT,
  },
];

/**
 * Checks that a rate limit option is a positive integer.
 *
 * @param name - The option being checked, used in the error message.
 * @param value - The value to check.
 * @throws {Error} If `value` is not a positive integer.
 */
export function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid rate limit: ${name} must be a positive integer, received ${String(
        value,
      )}`,
    );
  }
}

/**
 * Checks that a rate limit option is a positive, finite number.
 *
 * @param name - The option being checked, used in the error message.
 * @param value - The value to check.
 * @throws {Error} If `value` is not a positive, finite number.
 */
export function assertPositiveNumber(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Invalid rate limit: ${name} must be a positive number, received ${String(
        value,
      )}`,
    );
  }
}
