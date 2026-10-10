import {
  ConflictException,
  Injectable,
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

import { AccessTokenPayload, CognitoConfig } from './cognito.types';
import { getCognitoConfig, isAuthDisabled } from './cognito.config';
import { CreateCognitoUserDto } from './dtos/create-cognito-user.dto';

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private providerClient: CognitoIdentityProviderClient | null = null;

  /**
   * Lazily initializes and returns the Cognito admin client.
   * Only available when auth is enabled (Cognito is configured).
   */
  private getProviderClient(): CognitoIdentityProviderClient {
    if (this.providerClient) return this.providerClient;

    const config = this.requireConfig();
    this.providerClient = new CognitoIdentityProviderClient({
      region: config.region,
    });
    return this.providerClient;
  }

  /**
   * Returns the resolved Cognito config or throws if auth is disabled.
   */
  private requireConfig(): CognitoConfig {
    const config = getCognitoConfig();
    if (!config) {
      throw new InternalServerErrorException(
        'Cognito user management is unavailable: authentication is disabled.',
      );
    }
    return config;
  }

  /**
   * Retrieves the authenticated user's verified access token payload from the request.
   *
   * The {@link CognitoJWTGuard} verifies the incoming bearer token and attaches the
   * decoded payload to `request.user` before the route handler runs. This method reads
   * that payload back out in a type-safe way, since Express's `Request` type has no
   * knowledge of the `user` property the guard adds.
   *
   * @param request - The incoming Express request, expected to have passed through {@link CognitoJWTGuard}.
   * @returns The verified {@link AccessTokenPayload} for the authenticated user, or `null`
   *   if authentication is disabled or no valid token was attached to the request.
   */
  getUser(request: Request): AccessTokenPayload | null {
    // If authentication was explicitly disabled, there is no user to return.
    // Reads the flag rather than re-resolving the config: the guard already ran.
    if (isAuthDisabled()) {
      this.logger.debug(
        'getUser returning null: authentication is disabled (AUTH_DISABLED=true)',
      );
      return null;
    }
    // The CognitoJWTGuard attaches the verified JWT payload to request.user,
    // but Express's Request type doesn't know about it, so we widen the type.
    const authenticatedRequest = request as Request & {
      user: AccessTokenPayload;
    };

    // user may be undefined if no token was attached; normalize that to null.
    if (!authenticatedRequest.user) {
      this.logger.warn(
        'getUser returning null: no verified user attached to the request. ' +
          'Auth is enabled, request bypassed CognitoJWTGuard (a @Public() route) or the guard did not run for this handler.',
      );
      return null;
    }
    return authenticatedRequest.user;
  }

  /**
   * Creates a user in the Cognito user pool and assigns them to a group (role).
   * Cognito sends a temporary-password email to the user automatically.
   *
   * @returns The Cognito `sub` (unique user ID) for the newly created user.
   */
  async createUser({
    firstName,
    lastName,
    email,
    role,
  }: CreateCognitoUserDto): Promise<string> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new AdminCreateUserCommand({
      UserPoolId: config.userPoolId,
      Username: email,
      UserAttributes: [
        { Name: 'name', Value: `${firstName} ${lastName}` },
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    });

    let sub: string | undefined;
    try {
      const response = await client.send(command);
      sub = response.User?.Attributes?.find(
        (attr) => attr.Name === 'sub',
      )?.Value;
    } catch (error) {
      if (error instanceof Error && error.name === 'UsernameExistsException') {
        throw new ConflictException('A user with this email already exists');
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to create user: ${reason}`,
      );
    }

    // Cognito should always return a sub for a created user; a missing one would
    // only come from an AWS outage or internal bug.
    if (!sub) {
      await this.deletePartiallyCreatedUser(email);
      throw new InternalServerErrorException(
        'Failed to create user: Cognito returned no sub',
      );
    }

    try {
      await this.addUserToGroup(email, role);
    } catch (error) {
      // A user that exists but isn't in a group is in a broken state with no
      // role, so delete it rather than leave a login that can't be used.
      await this.deletePartiallyCreatedUser(email);
      throw error;
    }

    return sub;
  }

  private async deletePartiallyCreatedUser(email: string): Promise<void> {
    await this.deleteUser(email).catch(() =>
      this.logger.error(`Failed to delete partially created user ${email}`),
    );
  }

  async addUserToGroup(username: string, groupName: string): Promise<void> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new AdminAddUserToGroupCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      GroupName: groupName,
    });

    try {
      await client.send(command);
    } catch (error) {
      this.logger.error(
        `Failed to add user ${username} to group ${groupName}`,
        error,
      );
      const reason = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to add user to group ${groupName}: ${reason}`,
      );
    }
  }

  async removeUserFromGroup(
    username: string,
    groupName: string,
  ): Promise<void> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new AdminRemoveUserFromGroupCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      GroupName: groupName,
    });

    try {
      await client.send(command);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to remove user from group ${groupName}: ${reason}`,
      );
    }
  }

  async disableUser(email: string): Promise<void> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new AdminDisableUserCommand({
      UserPoolId: config.userPoolId,
      Username: email,
    });

    try {
      await client.send(command);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to disable user: ${reason}`,
      );
    }
  }

  async enableUser(email: string): Promise<void> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new AdminEnableUserCommand({
      UserPoolId: config.userPoolId,
      Username: email,
    });

    try {
      await client.send(command);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to enable user: ${reason}`,
      );
    }
  }

  async deleteUser(email: string): Promise<void> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new AdminDeleteUserCommand({
      UserPoolId: config.userPoolId,
      Username: email,
    });

    try {
      await client.send(command);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to delete user: ${reason}`,
      );
    }
  }
}
