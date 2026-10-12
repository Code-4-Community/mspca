import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
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
  SignUpCommand,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import {
  AccessTokenPayload,
  CognitoConfig,
  CognitoRole,
} from './cognito.types';
import { getCognitoConfig, isAuthDisabled } from './cognito.config';
import { CreateCognitoUserDto } from './dtos/create-cognito-user.dto';
import { SignUpCognitoUserDto } from './dtos/sign-up-cognito-user.dto';

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
   * Creates a user on someone else's behalf (e.g. an admin creating a Foster
   * Coordinator) and assigns them to a group (role).
   *
   * Uses an admin command, so the email is marked verified up front and Cognito
   * emails the user a temporary password. Self-service sign-ups should use
   * {@link signUpUser} instead so the user verifies their own email.
   * If the user is created but can't be added to the group, they are deleted.
   *
   * @param dto - The user's name, email, and the role (group) to assign.
   * @returns The Cognito `sub` (unique user ID) for the newly created user.
   * @throws {ConflictException} If a user with the email already exists.
   * @throws {InternalServerErrorException} If the user could not be created or added to the group.
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
      await this.deleteUser(email).catch(() =>
        this.logger.error(`Failed to delete partially created user ${email}`),
      );
      throw new InternalServerErrorException(
        'Failed to create user: Cognito returned no sub',
      );
    }

    try {
      await this.addUserToGroup(email, role);
    } catch (error) {
      // A user that exists but isn't in a group is in a broken state with no
      // role, so delete it rather than leave a login that can't be used.
      await this.deleteUser(email).catch(() =>
        this.logger.error(`Failed to delete partially created user ${email}`),
      );
      throw error;
    }

    return sub;
  }

  /**
   * Registers a self-service user with the email and password they chose.
   *
   * Cognito emails the user a verification code; they can't sign in until it is
   * passed to {@link confirmUser}. The user is not added to a group here, since
   * that should only happen once their email is verified.
   *
   * @param dto - The user's name, email, and chosen password.
   * @returns The Cognito `sub` (unique user ID) for the new, unconfirmed user.
   * @throws {ConflictException} If a user with the email already exists.
   * @throws {BadRequestException} If Cognito rejects the password or another parameter.
   * @throws {InternalServerErrorException} If the user could not be registered.
   */
  async signUpUser({
    firstName,
    lastName,
    email,
    password,
  }: SignUpCognitoUserDto): Promise<string> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new SignUpCommand({
      ClientId: config.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: `${firstName} ${lastName}` },
      ],
    });

    let sub: string | undefined;
    try {
      const response = await client.send(command);
      sub = response.UserSub;
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const reason = error instanceof Error ? error.message : String(error);
      if (name === 'UsernameExistsException') {
        throw new ConflictException('A user with this email already exists');
      }
      if (
        name === 'InvalidPasswordException' ||
        name === 'InvalidParameterException'
      ) {
        throw new BadRequestException(reason);
      }
      throw new InternalServerErrorException(
        `Failed to sign up user: ${reason}`,
      );
    }

    // Cognito should always return a sub for a registered user; a missing one
    // would only come from an AWS outage or internal bug.
    if (!sub) {
      await this.deleteUser(email).catch(() =>
        this.logger.error(`Failed to delete partially created user ${email}`),
      );
      throw new InternalServerErrorException(
        'Failed to sign up user: Cognito returned no sub',
      );
    }

    return sub;
  }

  /**
   * Confirms a self-service user's email with the code Cognito sent them, then
   * assigns them to a group (role).
   *
   * If the user is confirmed but can't be added to the group, they are deleted,
   * since a confirmed user with no role can't use the app.
   *
   * @param email - The user's email (their Cognito username).
   * @param code - The verification code from the sign-up email.
   * @param role - The role (group) to assign once confirmed.
   * @throws {BadRequestException} If the code is wrong or has expired.
   * @throws {NotFoundException} If no user with the email exists.
   * @throws {ConflictException} If the user can't be confirmed, e.g. they already are.
   * @throws {InternalServerErrorException} If confirmation or adding to the group fails.
   */
  async confirmUser(
    email: string,
    code: string,
    role: CognitoRole,
  ): Promise<void> {
    const config = this.requireConfig();
    const client = this.getProviderClient();

    const command = new ConfirmSignUpCommand({
      ClientId: config.clientId,
      Username: email,
      ConfirmationCode: code,
    });

    try {
      await client.send(command);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const reason = error instanceof Error ? error.message : String(error);
      if (name === 'CodeMismatchException') {
        throw new BadRequestException('Invalid verification code');
      }
      if (name === 'ExpiredCodeException') {
        throw new BadRequestException('Verification code has expired');
      }
      if (name === 'UserNotFoundException') {
        throw new NotFoundException('No user with this email exists');
      }
      if (name === 'NotAuthorizedException') {
        throw new ConflictException(`User cannot be confirmed: ${reason}`);
      }
      throw new InternalServerErrorException(
        `Failed to confirm user: ${reason}`,
      );
    }

    try {
      await this.addUserToGroup(email, role);
    } catch (error) {
      // A confirmed user that isn't in a group is in a broken state with no
      // role, so delete it rather than leave a login that can't be used.
      await this.deleteUser(email).catch(() =>
        this.logger.error(`Failed to delete partially created user ${email}`),
      );
      throw error;
    }
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

  /**
   * Permanently deletes a user from the Cognito user pool.
   *
   * Also used to roll back users left half-created by {@link createUser},
   * {@link signUpUser}, {@link confirmUser}, or a failed Volunteer save.
   *
   * @param email - The user's email (their Cognito username).
   * @throws {InternalServerErrorException} If Cognito fails to delete the user.
   */
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
