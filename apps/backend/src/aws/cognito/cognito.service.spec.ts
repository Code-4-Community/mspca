import {
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import { AuthConfigurationError } from './cognito.config';
import { CognitoService } from './cognito.service';
import { AccessTokenPayload, CognitoRole } from './cognito.types';

type TestRequest = Request & { user?: AccessTokenPayload };

const ENV_KEYS = [
  'AUTH_DISABLED',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'COGNITO_REGION',
] as const;

// Snapshot the auth env once so each test can mutate it freely without
// clobbering a value the developer had set in their own shell.
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

// Only the user pool ID and client ID are required to enable auth. COGNITO_REGION
// is optional: when unset it is derived from the user pool ID (format <region>_<id>).
const REQUIRED_ENV_KEYS = [
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
] as const;

describe('CognitoService', () => {
  describe('getUser', () => {
    let service: CognitoService;

    beforeEach(() => {
      delete process.env.AUTH_DISABLED;
      process.env.COGNITO_USER_POOL_ID = 'us-east-2_TestPool';
      process.env.COGNITO_CLIENT_ID = '4h57k9lmno1pqrstuv2wxyz3ab';
      process.env.COGNITO_REGION = 'us-east-2';
      service = new CognitoService();
    });

    // Restore environment variables after each test
    afterEach(() => {
      restoreEnv();
    });

    // Auth is only ever off by explicit opt-in, in which case there is no user
    // to return regardless of the request.
    it('returns null when auth is explicitly disabled', () => {
      process.env.AUTH_DISABLED = 'true';

      expect(service.getUser({ headers: {} } as TestRequest)).toBeNull();
    });

    // getUser reads the AUTH_DISABLED flag rather than re-resolving the config, so
    // an unusable config is not its problem to report: CognitoModule already failed
    // startup over it, and CognitoJWTGuard resolves the config ahead of its @Public()
    // branch, so every request 401s before any handler can call getUser.
    it.each(REQUIRED_ENV_KEYS)(
      'returns null rather than throwing when %s is missing (the guard owns that rejection)',
      (missingKey) => {
        delete process.env[missingKey];

        expect(service.getUser({ headers: {} } as TestRequest)).toBeNull();
      },
    );

    // The flag itself is still parsed strictly: a typo must never be read as
    // "not disabled" and silently return a user.
    it('throws when AUTH_DISABLED has an unrecognized value', () => {
      process.env.AUTH_DISABLED = 'ture';

      expect(() => service.getUser({ headers: {} } as TestRequest)).toThrow(
        AuthConfigurationError,
      );
    });

    // COGNITO_REGION is optional (derived from the user pool ID), so auth stays
    // enabled without it and getUser still returns an attached payload.
    it('returns the JWT payload when COGNITO_REGION is missing (region derived)', () => {
      delete process.env.COGNITO_REGION;

      const payload: AccessTokenPayload = {
        sub: 'user-1',
        client_id: 'test-client',
        token_use: 'access',
        iss: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_TestPool',
        exp: 9999999999,
        iat: 1,
      };
      const request = { user: payload } as TestRequest;

      expect(service.getUser(request)).toEqual(payload);
    });

    it('returns the JWT payload when auth is active and user is on the request', () => {
      const payload: AccessTokenPayload = {
        sub: 'user-1',
        client_id: 'test-client',
        token_use: 'access',
        iss: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_TestPool',
        exp: 9999999999,
        iat: 1,
      };
      const request = { user: payload } as TestRequest;

      expect(service.getUser(request)).toEqual(payload);
    });

    it('returns null when auth is active and user is not on the request', () => {
      expect(service.getUser({ headers: {} } as TestRequest)).toBeNull();
    });
  });

  describe('user management', () => {
    let service: CognitoService;
    let sendSpy: jest.SpyInstance;

    beforeEach(() => {
      delete process.env.AUTH_DISABLED;
      process.env.COGNITO_USER_POOL_ID = 'us-east-2_TestPool';
      process.env.COGNITO_CLIENT_ID = '4h57k9lmno1pqrstuv2wxyz3ab';
      process.env.COGNITO_REGION = 'us-east-2';
      service = new CognitoService();

      // Force the lazy client to initialize, then spy on send
      const mockClient = { send: jest.fn().mockResolvedValue({}) };
      service['providerClient'] =
        mockClient as unknown as CognitoIdentityProviderClient;
      sendSpy = mockClient.send;
    });

    afterEach(() => {
      restoreEnv();
      jest.restoreAllMocks();
    });

    describe('createUser', () => {
      it('creates a user and adds them to a group', async () => {
        sendSpy
          .mockResolvedValueOnce({
            User: {
              Attributes: [{ Name: 'sub', Value: 'test-sub-123' }],
            },
          })
          .mockResolvedValueOnce({}); // addUserToGroup

        const sub = await service.createUser({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          role: CognitoRole.FosterVolunteer,
        });

        expect(sub).toBe('test-sub-123');
        expect(sendSpy).toHaveBeenCalledTimes(2);

        const createCmd = sendSpy.mock.calls[0][0];
        expect(createCmd).toBeInstanceOf(AdminCreateUserCommand);
        expect(createCmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
          UserAttributes: [
            { Name: 'name', Value: 'Jane Doe' },
            { Name: 'email', Value: 'jane@example.com' },
            { Name: 'email_verified', Value: 'true' },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        });

        const groupCmd = sendSpy.mock.calls[1][0];
        expect(groupCmd).toBeInstanceOf(AdminAddUserToGroupCommand);
        expect(groupCmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
          GroupName: CognitoRole.FosterVolunteer,
        });
      });

      it('throws ConflictException when user already exists', async () => {
        const error = new Error('User already exists');
        error.name = 'UsernameExistsException';
        sendSpy.mockRejectedValueOnce(error);

        await expect(
          service.createUser({
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: CognitoRole.FosterVolunteer,
          }),
        ).rejects.toThrow(
          new ConflictException('A user with this email already exists'),
        );

        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(AdminCreateUserCommand);
      });

      it('throws InternalServerErrorException on unknown error', async () => {
        sendSpy.mockRejectedValueOnce(new Error('Cognito down'));

        await expect(
          service.createUser({
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: CognitoRole.FosterVolunteer,
          }),
        ).rejects.toThrow(
          new InternalServerErrorException(
            'Failed to create user: Cognito down',
          ),
        );

        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(AdminCreateUserCommand);
      });

      it('deletes the user and throws when Cognito returns no sub', async () => {
        sendSpy
          .mockResolvedValueOnce({ User: { Attributes: [] } })
          .mockResolvedValueOnce({}); // deleteUser

        await expect(
          service.createUser({
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: CognitoRole.FosterVolunteer,
          }),
        ).rejects.toThrow(
          new InternalServerErrorException(
            'Failed to create user: Cognito returned no sub',
          ),
        );

        expect(sendSpy).toHaveBeenCalledTimes(2);
        expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(AdminCreateUserCommand);
        const deleteCmd = sendSpy.mock.calls[1][0];
        expect(deleteCmd).toBeInstanceOf(AdminDeleteUserCommand);
        expect(deleteCmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
        });
      });

      it('deletes the user and throws when adding to the group fails', async () => {
        sendSpy
          .mockResolvedValueOnce({
            User: { Attributes: [{ Name: 'sub', Value: 'test-sub-123' }] },
          })
          .mockRejectedValueOnce(new Error('Group not found'))
          .mockResolvedValueOnce({}); // deleteUser
        jest.spyOn(Logger.prototype, 'error').mockImplementation();

        await expect(
          service.createUser({
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: CognitoRole.FosterVolunteer,
          }),
        ).rejects.toThrow(InternalServerErrorException);

        expect(sendSpy).toHaveBeenCalledTimes(3);
        expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(AdminCreateUserCommand);
        const groupCmd = sendSpy.mock.calls[1][0];
        expect(groupCmd).toBeInstanceOf(AdminAddUserToGroupCommand);
        expect(groupCmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
          GroupName: CognitoRole.FosterVolunteer,
        });
        const deleteCmd = sendSpy.mock.calls[2][0];
        expect(deleteCmd).toBeInstanceOf(AdminDeleteUserCommand);
        expect(deleteCmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
        });
      });

      it('throws the original error when cleanup also fails', async () => {
        sendSpy
          .mockResolvedValueOnce({
            User: { Attributes: [{ Name: 'sub', Value: 'test-sub-123' }] },
          })
          .mockRejectedValueOnce(new Error('Group not found'))
          .mockRejectedValueOnce(new Error('Cognito down'));
        const logError = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation();

        await expect(
          service.createUser({
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: CognitoRole.FosterVolunteer,
          }),
        ).rejects.toThrow(/Failed to add user to group/);
        expect(logError).toHaveBeenCalledWith(
          'Failed to delete partially created user jane@example.com',
        );
      });

      it('throws when auth is disabled', async () => {
        process.env.AUTH_DISABLED = 'true';

        await expect(
          service.createUser({
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: CognitoRole.FosterVolunteer,
          }),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('addUserToGroup', () => {
      it('sends AdminAddUserToGroupCommand', async () => {
        await service.addUserToGroup('jane@example.com', CognitoRole.Admin);

        expect(sendSpy).toHaveBeenCalledTimes(1);
        const cmd = sendSpy.mock.calls[0][0];
        expect(cmd).toBeInstanceOf(AdminAddUserToGroupCommand);
        expect(cmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
          GroupName: CognitoRole.Admin,
        });
      });

      it('throws InternalServerErrorException on failure', async () => {
        sendSpy.mockRejectedValueOnce(new Error('fail'));

        await expect(
          service.addUserToGroup('jane@example.com', CognitoRole.Admin),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('removeUserFromGroup', () => {
      it('sends AdminRemoveUserFromGroupCommand', async () => {
        await service.removeUserFromGroup(
          'jane@example.com',
          CognitoRole.Admin,
        );

        expect(sendSpy).toHaveBeenCalledTimes(1);
        const cmd = sendSpy.mock.calls[0][0];
        expect(cmd).toBeInstanceOf(AdminRemoveUserFromGroupCommand);
        expect(cmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
          GroupName: CognitoRole.Admin,
        });
      });

      it('throws InternalServerErrorException on failure', async () => {
        sendSpy.mockRejectedValueOnce(new Error('fail'));

        await expect(
          service.removeUserFromGroup('jane@example.com', CognitoRole.Admin),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('disableUser', () => {
      it('sends AdminDisableUserCommand', async () => {
        await service.disableUser('jane@example.com');

        expect(sendSpy).toHaveBeenCalledTimes(1);
        const cmd = sendSpy.mock.calls[0][0];
        expect(cmd).toBeInstanceOf(AdminDisableUserCommand);
        expect(cmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
        });
      });

      it('throws InternalServerErrorException on failure', async () => {
        sendSpy.mockRejectedValueOnce(new Error('Cognito down'));

        await expect(service.disableUser('jane@example.com')).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });

    describe('deleteUser', () => {
      it('sends AdminDeleteUserCommand', async () => {
        await service.deleteUser('jane@example.com');

        expect(sendSpy).toHaveBeenCalledTimes(1);
        const cmd = sendSpy.mock.calls[0][0];
        expect(cmd).toBeInstanceOf(AdminDeleteUserCommand);
        expect(cmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
        });
      });

      it('throws InternalServerErrorException on failure', async () => {
        sendSpy.mockRejectedValueOnce(new Error('Cognito down'));

        await expect(service.deleteUser('jane@example.com')).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });

    describe('enableUser', () => {
      it('sends AdminEnableUserCommand', async () => {
        await service.enableUser('jane@example.com');

        expect(sendSpy).toHaveBeenCalledTimes(1);
        const cmd = sendSpy.mock.calls[0][0];
        expect(cmd).toBeInstanceOf(AdminEnableUserCommand);
        expect(cmd.input).toEqual({
          UserPoolId: 'us-east-2_TestPool',
          Username: 'jane@example.com',
        });
      });

      it('throws InternalServerErrorException on failure', async () => {
        sendSpy.mockRejectedValueOnce(new Error('Cognito down'));

        await expect(service.enableUser('jane@example.com')).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });
  });
});
