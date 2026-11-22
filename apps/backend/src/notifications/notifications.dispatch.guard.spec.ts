import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  DISPATCH_SECRET_HEADER,
  NotificationsDispatchGuard,
} from './notifications.dispatch.guard';

const SECRET = 'a-very-secret-value';

const contextWith = (headers: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext);

describe('NotificationsDispatchGuard', () => {
  let guard: NotificationsDispatchGuard;
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.NOTIFICATIONS_DISPATCH_SECRET;
    process.env.NOTIFICATIONS_DISPATCH_SECRET = SECRET;
    guard = new NotificationsDispatchGuard();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.NOTIFICATIONS_DISPATCH_SECRET;
    } else {
      process.env.NOTIFICATIONS_DISPATCH_SECRET = originalSecret;
    }
  });

  it('allows a request presenting the configured secret', () => {
    expect(
      guard.canActivate(contextWith({ [DISPATCH_SECRET_HEADER]: SECRET })),
    ).toBe(true);
  });

  it.each([
    ['a wrong secret', { [DISPATCH_SECRET_HEADER]: 'nope' }],
    [
      'a secret of matching length',
      { [DISPATCH_SECRET_HEADER]: 'b'.repeat(SECRET.length) },
    ],
  ])('rejects %s as an invalid secret', (_label, headers) => {
    expect(() => guard.canActivate(contextWith(headers))).toThrow(
      new UnauthorizedException('Invalid dispatch secret'),
    );
  });

  it.each([
    ['no header at all', {}],
    ['a non-string header', { [DISPATCH_SECRET_HEADER]: ['a', 'b'] }],
  ])('rejects %s as a missing header', (_label, headers) => {
    expect(() => guard.canActivate(contextWith(headers))).toThrow(
      new UnauthorizedException(`Missing ${DISPATCH_SECRET_HEADER} header`),
    );
  });

  it('fails closed when no secret is configured', () => {
    delete process.env.NOTIFICATIONS_DISPATCH_SECRET;

    expect(() =>
      guard.canActivate(contextWith({ [DISPATCH_SECRET_HEADER]: SECRET })),
    ).toThrow(
      new UnauthorizedException(
        'Dispatch secret is not configured on the server',
      ),
    );
  });
});
