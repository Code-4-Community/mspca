import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { Request } from 'express';
import request from 'supertest';
import { CognitoJWTGuard } from '../aws/cognito/cognito.guard';
import { Public } from '../aws/cognito/cognito.decorator';
import { AccessTokenPayload } from '../aws/cognito/cognito.types';
import { AuthThenRateLimitGuard } from './auth-then-rate-limit.guard';
import { RateLimit, SkipRateLimit } from './rate-limit.decorators';
import { RateLimitGuard } from './rate-limit.guard';
import {
  DEFAULT_THROTTLERS,
  PROTECTED_DEFAULT_LIMIT,
  PUBLIC_DEFAULT_LIMIT,
  isPublicRoute,
} from './rate-limit.utils';

// jwks-rsa's ESM dependency can't be parsed by Jest, so it's stubbed (as in cognito.module.spec.ts).
jest.mock('jwks-rsa', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const CUSTOM_LIMIT = 3;
const USER_HEADER = 'x-test-user';
const AUTH_FAIL_HEADER = 'x-test-auth-fail';

/**
 * Stands in for CognitoJWTGuard, which needs real Cognito tokens.
 *
 * Like the real guard, it lets public routes through without setting
 * request.user. On protected routes it throws 401 when the auth-fail test
 * header is sent, and otherwise sets request.user from the user test header, so
 * tests can act as different logged-in users. Neither header means "not logged
 * in", like running locally with AUTH_DISABLED=true.
 */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(context)) {
      return true;
    }
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();
    if (req.headers[AUTH_FAIL_HEADER]) {
      throw new UnauthorizedException();
    }
    const userId = req.headers[USER_HEADER];
    if (typeof userId === 'string') {
      req.user = { sub: userId } as AccessTokenPayload;
    }
    return true;
  }
}

@Public()
@Controller('public')
class PublicTestController {
  @Get('default')
  defaultLimit(): string {
    return 'ok';
  }

  @Get('custom')
  @RateLimit({ limit: CUSTOM_LIMIT, ttl: minutes(1) })
  custom(): string {
    return 'ok';
  }

  @Get('skipped')
  @SkipRateLimit()
  skipped(): string {
    return 'ok';
  }
}

@Controller('protected')
class ProtectedTestController {
  @Get('default')
  defaultLimit(): string {
    return 'ok';
  }

  @Get('custom')
  @RateLimit({ limit: CUSTOM_LIMIT, ttl: minutes(1) })
  custom(): string {
    return 'ok';
  }

  @Get('skipped')
  @SkipRateLimit()
  skipped(): string {
    return 'ok';
  }
}

describe('RateLimitGuard', () => {
  let app: INestApplication;

  // A fresh app per test resets the in-memory request counts.
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(DEFAULT_THROTTLERS)],
      controllers: [PublicTestController, ProtectedTestController],
      providers: [
        // Same wiring as CognitoModule, with FakeAuthGuard in place of CognitoJWTGuard.
        { provide: CognitoJWTGuard, useClass: FakeAuthGuard },
        RateLimitGuard,
        { provide: APP_GUARD, useClass: AuthThenRateLimitGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /**
   * Sends GET requests one at a time, so the counts are predictable.
   *
   * @param path - The route to call.
   * @param count - How many requests to send.
   * @param headers - Headers to send with every request, such as the user test header.
   * @returns The status code of each response, in order.
   */
  async function sendRequests(
    path: string,
    count: number,
    headers: Record<string, string> = {},
  ): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set(headers);
      statuses.push(response.status);
    }
    return statuses;
  }

  describe('public routes', () => {
    it('allows requests up to the public default, then returns 429', async () => {
      const statuses = await sendRequests(
        '/public/default',
        PUBLIC_DEFAULT_LIMIT + 1,
      );

      expect(statuses).toEqual([...Array(PUBLIC_DEFAULT_LIMIT).fill(200), 429]);
    });

    it('allows requests under a custom limit', async () => {
      const statuses = await sendRequests('/public/custom', CUSTOM_LIMIT - 1);

      expect(statuses).toEqual(Array(CUSTOM_LIMIT - 1).fill(200));
    });

    it('allows requests exactly at a custom limit', async () => {
      const statuses = await sendRequests('/public/custom', CUSTOM_LIMIT);

      expect(statuses).toEqual(Array(CUSTOM_LIMIT).fill(200));
    });

    it('returns 429 once a custom limit is exceeded', async () => {
      const statuses = await sendRequests('/public/custom', CUSTOM_LIMIT + 2);

      expect(statuses).toEqual([...Array(CUSTOM_LIMIT).fill(200), 429, 429]);
    });

    it('counts requests by IP, even if they claim different users', async () => {
      await sendRequests('/public/custom', CUSTOM_LIMIT, {
        [USER_HEADER]: 'user-a',
      });

      const statuses = await sendRequests('/public/custom', 1, {
        [USER_HEADER]: 'user-b',
      });

      expect(statuses).toEqual([429]);
    });

    it('never limits a route marked @SkipRateLimit()', async () => {
      const count = PUBLIC_DEFAULT_LIMIT + 5;
      const statuses = await sendRequests('/public/skipped', count);

      expect(statuses).toEqual(Array(count).fill(200));
    });
  });

  describe('protected routes', () => {
    it('allows requests up to the protected default, then returns 429', async () => {
      const statuses = await sendRequests(
        '/protected/default',
        PROTECTED_DEFAULT_LIMIT + 1,
      );

      expect(statuses).toEqual([
        ...Array(PROTECTED_DEFAULT_LIMIT).fill(200),
        429,
      ]);
    });

    it('counts each logged-in user separately', async () => {
      const userA = await sendRequests('/protected/custom', CUSTOM_LIMIT + 1, {
        [USER_HEADER]: 'user-a',
      });
      const userB = await sendRequests('/protected/custom', CUSTOM_LIMIT, {
        [USER_HEADER]: 'user-b',
      });

      expect(userA).toEqual([...Array(CUSTOM_LIMIT).fill(200), 429]);
      expect(userB).toEqual(Array(CUSTOM_LIMIT).fill(200));
    });

    it('counts failed authentications by IP, returning 401 until the limit, then 429', async () => {
      const statuses = await sendRequests(
        '/protected/custom',
        CUSTOM_LIMIT + 1,
        {
          [AUTH_FAIL_HEADER]: 'true',
        },
      );

      expect(statuses).toEqual([...Array(CUSTOM_LIMIT).fill(401), 429]);
    });

    it('never limits a route marked @SkipRateLimit()', async () => {
      const count = PROTECTED_DEFAULT_LIMIT + 5;
      const statuses = await sendRequests('/protected/skipped', count);

      expect(statuses).toEqual(Array(count).fill(200));
    });
  });

  describe('requests without an IP address', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it('counts the request under a shared key and logs a warning', async () => {
      const guard = app.get(RateLimitGuard);

      const tracker = await guard['getTracker']({
        ip: undefined,
      } as unknown as Request);

      expect(tracker).toBe('ip:unknown');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'Request has no IP address, so it is rate limited under the shared key "ip:unknown"',
      );
    });

    it('does not log a warning when the request has an IP address', async () => {
      const guard = app.get(RateLimitGuard);

      const tracker = await guard['getTracker']({
        ip: '203.0.113.7',
      } as unknown as Request);

      expect(tracker).toBe('ip:203.0.113.7');
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
