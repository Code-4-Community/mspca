import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
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
   * The CognitoJWTGuard verifies the incoming bearer token and attaches the
   * decoded payload to request.user before the route handler runs.
   */
  getUser(request: Request): AccessTokenPayload | null {
    if (isAuthDisabled()) {
      this.logger.debug(
        'getUser returning null: authentication is disabled (AUTH_DISABLED=true)',
      );
      return null;
    }

    const authenticatedRequest = request as Request & {
      user: AccessTokenPayload;
    };

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
   * Creates a user on someone else's behalf and assigns them to a group.
   * Self-service sign-ups should use signUpUser instead.
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
      this.logger.error(`Failed to create user ${email}`, error);
      throw new InternalServerErrorException('Failed to create user');
    }

    if (!sub) {
      this.logger.error(`Cognito returned no sub when creating ${email}`);
      try {
        await this.deleteUser(email);
      } catch {
        this.logger.error(`Failed to delete partially created user ${email}`);
      }
      throw new InternalServerErrorException('Failed to create user');
    }

    try {
      await this.addUserToGroup(email, role);
    } catch (error) {
      try {
        await this.deleteUser(email);
      } catch {
        this.logger.error(`Failed to delete partially created user ${email}`);
      }
      throw error;
    }

    return sub;
  }

  /**
   * Registers a self-service user with their chosen email and password.
   * Cognito emails a verification code. The user is not added to a group
   * until their email is confirmed.
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

      if (name === 'UsernameExistsException') {
        throw new ConflictException('A user with this email already exists');
      }
      if (name === 'InvalidPasswordException') {
        throw new BadRequestException(
          'Password does not meet the requirements',
        );
      }
      if (name === 'InvalidParameterException') {
        throw new BadRequestException('Invalid email or password');
      }

      this.logger.error(`Failed to sign up user ${email}`, error);
      throw new InternalServerErrorException('Failed to sign up user');
    }

    if (!sub) {
      this.logger.error(`Cognito returned no sub when signing up ${email}`);
      try {
        await this.deleteUser(email);
      } catch {
        this.logger.error(`Failed to delete partially created user ${email}`);
      }
      throw new InternalServerErrorException('Failed to sign up user');
    }

    return sub;
  }

  /**
   * Confirms a self-service user's email with the code Cognito sent them,
   * then assigns them to a group (role).
   *
   * If the user is confirmed but cannot be added to the group, they are
   * deleted, since a confirmed user with no role cannot use the app.
   *
   * @param email - The user's email (their Cognito username).
   * @param code - The verification code from the sign-up email.
   * @param role - The role (group) to assign once confirmed.
   * @throws {BadRequestException} If the code is wrong or expired.
   * @throws {NotFoundException} If the user does not exist.
   * @throws {HttpException} 429 if there have been too many attempts.
   * @throws {InternalServerErrorException} If confirmation or group assignment fails.
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
        throw new BadRequestException(
          'User cannot be confirmed, or is already confirmed',
        );
      }
      if (
        name === 'LimitExceededException' ||
        name === 'TooManyFailedAttemptsException'
      ) {
        throw new HttpException(
          'Too many attempts, please try again later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      this.logger.error(`Failed to confirm user ${email}`, error);
      throw new InternalServerErrorException('Failed to confirm user');
    }

    try {
      await this.addUserToGroup(email, role);
    } catch {
      // addUserToGroup already logs the Cognito error.
      try {
        await this.deleteUser(email);
      } catch {
        this.logger.error(`Failed to delete partially created user ${email}`);
      }
      throw new InternalServerErrorException('Failed to confirm user');
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
      throw new InternalServerErrorException(
        `Failed to add user to group ${groupName}`,
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
      this.logger.error(
        `Failed to remove user ${username} from group ${groupName}`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to remove user from group ${groupName}`,
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
      this.logger.error(`Failed to disable user ${email}`, error);
      throw new InternalServerErrorException('Failed to disable user');
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
      this.logger.error(`Failed to enable user ${email}`, error);
      throw new InternalServerErrorException('Failed to enable user');
    }
  }

  /**
   * Permanently deletes a user from the Cognito user pool.
   * Also used to roll back partially created users.
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
      this.logger.error(`Failed to delete user ${email}`, error);
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
