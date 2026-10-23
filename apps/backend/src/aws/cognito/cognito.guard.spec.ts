import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from './cognito.decorator';
import { CognitoJWTGuard } from './cognito.guard';
import { AccessTokenPayload } from './cognito.types';

jest.mock('jsonwebtoken');

// Mock the JWKS public key provider.
jest.mock('jwks-rsa', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: () => 'mock-public-key',
    }),
  })),
}));

const ENV_KEYS = [
  'AUTH_DISABLED',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'COGNITO_REGION',
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function restoreEnv(): void {
  ENV_KEYS.forEach((key) => {
    const original = ORIGINAL_ENV[key];

    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  });
}

const REQUIRED_ENV_KEYS = [
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
] as const;

const ACTIVE_ENV = {
  COGNITO_USER_POOL_ID: 'us-east-2_TestPool',
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_REGION: 'us-east-2',
};

function setActiveEnv(): void {
  delete process.env.AUTH_DISABLED;
  Object.assign(process.env, ACTIVE_ENV);
}

// Used by the JWT verification tests that will be re-enabled
// when frontend sign-in is implemented.
function buildPayload(
  overrides: Partial<AccessTokenPayload> = {},
): Record<string, unknown> {
  return {
    sub: 'user-1',
    iss: `https://cognito-idp.${ACTIVE_ENV.COGNITO_REGION}.amazonaws.com/${ACTIVE_ENV.COGNITO_USER_POOL_ID}`,
    exp: 9999999999,
    iat: 1,
    ...overrides,
  };
}

function mockVerifyResolves(decoded: unknown): void {
  (jwt.verify as jest.Mock).mockImplementation(
    (_token, _getKey, _options, callback) => callback(null, decoded),
  );
}

function mockVerifyRejects(error: Error): void {
  (jwt.verify as jest.Mock).mockImplementation(
    (_token, _getKey, _options, callback) => callback(error, undefined),
  );
}

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: Request & { user?: AccessTokenPayload };
} {
  const request = {
    headers: authorization ? { authorization } : {},
  } as Request & { user?: AccessTokenPayload };

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('CognitoJWTGuard', () => {
  let guard: CognitoJWTGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };

    guard = new CognitoJWTGuard(reflector as unknown as Reflector);

    (jwt.verify as jest.Mock).mockReset();
  });

  afterEach(() => {
    restoreEnv();
    jest.clearAllMocks();
  });

  describe('When auth is active', () => {
    beforeEach(() => {
      setActiveEnv();
    });

    // TODO: Re-enable these JWT verification tests when easy
    // sign-in is implemented in the frontend and token
    // verification is restored in cognito.guard.ts.
    describe.skip('Bearer token extraction', () => {
      it('rejects routes without a Bearer token', async () => {
        const { context } = createContext();

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(jwt.verify).not.toHaveBeenCalled();
      });

      it('rejects routes with non-Bearer authorization', async () => {
        const { context } = createContext('Basic abc1234567890');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(jwt.verify).not.toHaveBeenCalled();
      });

      it('rejects routes with an empty Bearer token', async () => {
        const { context } = createContext('Bearer ');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(jwt.verify).not.toHaveBeenCalled();
      });

      it('rejects routes with a whitespace-only Bearer token', async () => {
        const { context } = createContext('Bearer    ');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(jwt.verify).not.toHaveBeenCalled();
      });
    });

    // TODO: Re-enable after JWT verification is restored.
    describe.skip('token verification and payload shape', () => {
      it('rejects routes when token verification fails', async () => {
        mockVerifyRejects(new Error('invalid signature'));

        const { context } = createContext('Bearer bad-token');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('rejects routes when the decoded token is a string', async () => {
        mockVerifyResolves('not-an-object');

        const { context } = createContext('Bearer weird-token');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('rejects routes when the payload is missing a required claim', async () => {
        mockVerifyResolves(
          buildPayload({
            sub: undefined,
            token_use: 'access',
            client_id: ACTIVE_ENV.COGNITO_CLIENT_ID,
          }),
        );

        const { context } = createContext('Bearer malformed-token');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    // TODO: Re-enable after JWT verification is restored.
    describe.skip('token type and value validation', () => {
      it('rejects ID tokens (token_use is not "access")', async () => {
        mockVerifyResolves(
          buildPayload({
            token_use: 'id' as AccessTokenPayload['token_use'],
            client_id: ACTIVE_ENV.COGNITO_CLIENT_ID,
          }),
        );

        const { context } = createContext('Bearer id-token');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('rejects access tokens whose client_id does not match', async () => {
        mockVerifyResolves(
          buildPayload({
            token_use: 'access',
            client_id: 'wrong-client-id',
          }),
        );

        const { context } = createContext('Bearer access-token');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('rejects access tokens with no client_id claim', async () => {
        mockVerifyResolves(buildPayload({ token_use: 'access' }));

        const { context } = createContext('Bearer access-token');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('allows routes with a valid access token (client_id)', async () => {
        const payload = buildPayload({
          client_id: ACTIVE_ENV.COGNITO_CLIENT_ID,
          token_use: 'access',
        });

        mockVerifyResolves(payload);

        const { context, request } = createContext('Bearer access-token');

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(request.user).toEqual(payload);
      });
    });

    // Temporary development behavior requested during PR review:
    // Cognito remains configured, but JWT verification is skipped.
    describe('temporary token verification bypass', () => {
      it('allows requests without a Bearer token', async () => {
        const { context, request } = createContext();

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
          IS_PUBLIC_KEY,
          expect.any(Array),
        );
        expect(jwt.verify).not.toHaveBeenCalled();
        expect(request.user).toBeUndefined();
      });

      it('allows requests with a non-Bearer authorization header', async () => {
        const { context, request } = createContext('Basic abc123');

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(request.user).toBeUndefined();
      });

      it('allows requests with an invalid Bearer token without verifying it', async () => {
        const { context, request } = createContext('Bearer invalid-token');

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(request.user).toBeUndefined();
      });

      it('does not attach an unverified user to the request', async () => {
        const { context, request } = createContext('Bearer access-token');

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(request.user).toBeUndefined();
        expect(jwt.verify).not.toHaveBeenCalled();
      });
    });

    describe('@Public routes', () => {
      beforeEach(() => {
        reflector.getAllAndOverride.mockImplementation(
          (key) => key === IS_PUBLIC_KEY,
        );
      });

      it('allows @Public routes without a token', async () => {
        const { context, request } = createContext();

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(request.user).toBeUndefined();
      });

      it('allows @Public routes without verifying any bearer token', async () => {
        const { context, request } = createContext('Bearer bad-token');

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(request.user).toBeUndefined();
      });
    });
  });

  describe('when auth is explicitly disabled', () => {
    beforeEach(() => {
      process.env.AUTH_DISABLED = 'true';
    });

    it('allows requests without a token', async () => {
      const { context } = createContext();

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(jwt.verify).not.toHaveBeenCalled();
    });

    it('ignores a bearer token when auth is disabled', async () => {
      const { context, request } = createContext('Bearer any-token');

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(request.user).toBeUndefined();
    });

    it.each(REQUIRED_ENV_KEYS)(
      'stays disabled when %s is missing',
      async (missingKey) => {
        setActiveEnv();
        process.env.AUTH_DISABLED = 'true';
        delete process.env[missingKey];

        const { context } = createContext('Bearer token');

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(jwt.verify).not.toHaveBeenCalled();
      },
    );
  });

  describe('when auth is misconfigured', () => {
    it.each(REQUIRED_ENV_KEYS)(
      'rejects requests when %s is missing and auth was not disabled',
      async (missingKey) => {
        setActiveEnv();
        delete process.env[missingKey];

        const { context, request } = createContext('Bearer token');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(request.user).toBeUndefined();
      },
    );

    it('rejects requests when no auth environment is configured at all', async () => {
      ENV_KEYS.forEach((key) => delete process.env[key]);

      const { context } = createContext('Bearer token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects requests when AUTH_DISABLED has an unrecognized value', async () => {
      setActiveEnv();
      process.env.AUTH_DISABLED = 'ture';

      const { context } = createContext('Bearer token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // COGNITO_REGION is optional and derived from the user pool ID.
  describe('when COGNITO_REGION is missing (region derived)', () => {
    it('keeps Cognito configured and allows the temporary bypass', async () => {
      setActiveEnv();
      delete process.env.COGNITO_REGION;

      const { context, request } = createContext('Bearer access-token');

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(request.user).toBeUndefined();
    });
  });
});
