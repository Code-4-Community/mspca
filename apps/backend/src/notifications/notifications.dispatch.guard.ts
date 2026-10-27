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
 * instead. Rejects everything while the secret is unset.
 */
@Injectable()
export class NotificationsDispatchGuard implements CanActivate {
  private readonly logger = new Logger(NotificationsDispatchGuard.name);

  /**
   * Checks the caller's secret against NOTIFICATIONS_DISPATCH_SECRET.
   *
   * @param context - The current execution context provided by NestJS.
   * @returns `true` when the presented secret matches.
   * @throws {UnauthorizedException} If the secret is wrong, missing, or unconfigured.
   */
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.NOTIFICATIONS_DISPATCH_SECRET;

    // Fail closed: an unset secret must never mean "let everyone through".
    if (!expected) {
      this.logger.error(
        'NOTIFICATIONS_DISPATCH_SECRET is not configured. Rejecting all dispatch requests.',
      );
      throw new UnauthorizedException();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[DISPATCH_SECRET_HEADER];

    if (typeof provided !== 'string' || !this.matches(provided, expected)) {
      this.logger.warn('Rejected a dispatch request with an invalid secret');
      throw new UnauthorizedException();
    }

    return true;
  }

  // Constant-time so timings can't leak the secret. Length first because
  // timingSafeEqual throws on a mismatch.
  private matches(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
