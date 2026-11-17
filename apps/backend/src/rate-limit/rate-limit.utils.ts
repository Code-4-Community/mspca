import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerOptions, minutes } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '../aws/cognito/cognito.decorator';

/**
 * Names of the two throttlers in DEFAULT_THROTTLERS. Import these instead of
 * typing the strings: @nestjs/throttler matches decorators to throttlers by
 * name, so a misspelled name matches nothing and the limit quietly won't apply.
 */
export const PUBLIC_THROTTLER = 'public';
export const PROTECTED_THROTTLER = 'protected';

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
 * Default rate limits, passed to ThrottlerModule.forRoot() in CognitoModule.
 * Each route uses exactly one throttler, chosen by route type:
 * - public routes (@Public()): 10 requests per minute, counted per IP
 * - protected routes: 100 requests per minute, counted per Cognito user
 *
 * Override these with @RateLimit(), or opt a route out with @SkipRateLimit().
 */
export const DEFAULT_THROTTLERS: ThrottlerOptions[] = [
  {
    name: PUBLIC_THROTTLER,
    ttl: minutes(1),
    limit: 10,
    skipIf: (context) => !isPublicRoute(context),
  },
  {
    name: PROTECTED_THROTTLER,
    ttl: minutes(1),
    limit: 100,
    skipIf: (context) => isPublicRoute(context),
  },
];
