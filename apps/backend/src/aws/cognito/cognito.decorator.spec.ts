import { Controller, Get, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import request from 'supertest';
import { IS_PUBLIC_KEY, Public } from './cognito.decorator';

const ROUTE_LIMIT = 3;
const DEFAULT_LIMIT = 2;
const PROTECTED_REQUEST_COUNT = 10;

@Controller('test')
class TestController {
  @Get('custom')
  @Public({ limit: ROUTE_LIMIT, ttl: minutes(1) })
  custom(): string {
    return 'ok';
  }

  @Get('other-custom')
  @Public({ limit: ROUTE_LIMIT, ttl: minutes(1) })
  otherCustom(): string {
    return 'ok';
  }

  @Get('default')
  @Public()
  defaultLimit(): string {
    return 'ok';
  }

  @Get('protected')
  protectedRoute(): string {
    return 'ok';
  }
}

describe('@Public() rate limiting', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: minutes(1), limit: DEFAULT_LIMIT }]),
      ],
      controllers: [TestController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function sendRequests(path: string, count: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      const response = await request(app.getHttpServer()).get(path);
      statuses.push(response.status);
    }
    return statuses;
  }

  describe('routes with a custom limit', () => {
    it('allows requests under the limit', async () => {
      const statuses = await sendRequests('/test/custom', ROUTE_LIMIT - 1);

      expect(statuses).toEqual(Array(ROUTE_LIMIT - 1).fill(200));
    });

    it('allows requests exactly at the limit', async () => {
      const statuses = await sendRequests('/test/custom', ROUTE_LIMIT);

      expect(statuses).toEqual(Array(ROUTE_LIMIT).fill(200));
    });

    it('returns 429 once the limit is exceeded', async () => {
      const statuses = await sendRequests('/test/custom', ROUTE_LIMIT + 2);

      expect(statuses).toEqual([...Array(ROUTE_LIMIT).fill(200), 429, 429]);
    });

    it('counts each route separately', async () => {
      await sendRequests('/test/custom', ROUTE_LIMIT + 1);

      const statuses = await sendRequests('/test/other-custom', ROUTE_LIMIT);

      expect(statuses).toEqual(Array(ROUTE_LIMIT).fill(200));
    });
  });

  describe('routes without a custom limit', () => {
    it('falls back to the ThrottlerModule default limit', async () => {
      const statuses = await sendRequests('/test/default', DEFAULT_LIMIT + 1);

      expect(statuses).toEqual([...Array(DEFAULT_LIMIT).fill(200), 429]);
    });
  });

  describe('protected routes', () => {
    it('are never rate limited', async () => {
      const statuses = await sendRequests(
        '/test/protected',
        PROTECTED_REQUEST_COUNT,
      );

      expect(statuses).toEqual(Array(PROTECTED_REQUEST_COUNT).fill(200));
    });
  });

  // CognitoJWTGuard reads this metadata to skip auth, so it must still be set
  describe('public metadata', () => {
    const reflector = new Reflector();

    it('marks @Public() routes as public', () => {
      expect(
        reflector.get(IS_PUBLIC_KEY, TestController.prototype.custom),
      ).toBe(true);
    });

    it('does not mark routes without @Public() as public', () => {
      expect(
        reflector.get(IS_PUBLIC_KEY, TestController.prototype.protectedRoute),
      ).toBeUndefined();
    });
  });
});
