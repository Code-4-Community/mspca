import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

export const DISPATCH_SECRET_HEADER = 'x-notifications-dispatch-secret';

/**
 * Guards the dispatch route so only the scheduled-notification Lambda can send.
 *
 * The Lambda has no Cognito account, so it identifies itself with a shared secret
 * instead.
 */
@Injectable()
export class NotificationsDispatchGuard implements CanActivate {
  private readonly logger = new Logger(NotificationsDispatchGuard.name);

  /**
   * Checks the caller's secret against NOTIFICATIONS_DISPATCH_SECRET.
   *
   * @param context - The current execution context provided by NestJS.
   * @returns `true` when the presented secret matches.
   * @throws {UnauthorizedException} If the secret is wrong or missing.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[DISPATCH_SECRET_HEADER];

    // Messages show up in the Lambda's "Dispatch failed" log. Never echo the value.
    if (typeof provided !== 'string') {
      this.logger.warn('Rejected a dispatch request with no secret header');
      throw new UnauthorizedException(
        `Missing ${DISPATCH_SECRET_HEADER} header`,
      );
    }

    // NotificationsModule requires the secret at boot; the fallback only satisfies TypeScript
    if (
      !this.matches(provided, process.env.NOTIFICATIONS_DISPATCH_SECRET ?? '')
    ) {
      this.logger.warn('Rejected a dispatch request with an invalid secret');
      throw new UnauthorizedException('Invalid dispatch secret');
    }

    return true;
  }

  /**
   * Compares the presented secret to the expected one in constant time.
   *
   * Constant-time so response timings can't leak the secret. Lengths are checked
   * first because timingSafeEqual throws when the buffers differ in length.
   *
   * @param provided - The secret from the request header.
   * @param expected - The configured NOTIFICATIONS_DISPATCH_SECRET.
   * @returns `true` when the two secrets are identical.
   */
  private matches(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
