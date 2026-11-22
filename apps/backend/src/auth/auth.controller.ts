import {
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Logger,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { VolunteersService } from '../volunteers/volunteers.service';
import { StaffService } from '../staff/staff.service';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { OwnersService } from '../owners/owners.service';
import { AuthenticatedUser } from './auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly cognitoService: CognitoService,
    private readonly volunteersService: VolunteersService,
    private readonly staffService: StaffService,
    private readonly coordinatorsService: CoordinatorsService,
    private readonly ownersService: OwnersService,
  ) {}

  /**
   * Returns the signed-in user, looked up by the Cognito sub in their token.
   *
   * The user's Cognito group decides which table they're looked up in. A user
   * should only be in one group. If they're in several, a warning is logged
   * and they get their least privileged role: FosterVolunteer, then
   * FosterCoordinator, then Owner.
   *
   * @param req - The request, after CognitoJWTGuard has verified its token.
   * @returns The user's role and their record.
   * @throws {UnauthorizedException} If no verified user is attached to the request.
   * @throws {ForbiddenException} If the user is in none of the app's groups.
   * @throws {NotFoundException} If no record matches the user's Cognito sub.
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get the signed-in user and their role',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The signed-in user and their role',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No valid access token was provided',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The user is not in any of the app's groups",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No user record matches the token's Cognito sub",
  })
  async getMe(@Req() req: Request): Promise<AuthenticatedUser> {
    const payload = this.cognitoService.getUser(req);
    if (!payload) {
      throw new UnauthorizedException('No user attached to the request');
    }

    const groups = payload['cognito:groups'] ?? [];

    const appRoles = Object.values(CognitoRole).filter((role) =>
      groups.includes(role),
    );
    if (appRoles.length > 1) {
      this.logger.warn(
        `User ${payload.sub} is in multiple groups (${appRoles.join(
          ', ',
        )}); using the least privileged role`,
      );
    }

    // CognitoRole lists roles from least to most privileged, so the first
    // match is the user's least privileged role.
    switch (appRoles[0]) {
      case CognitoRole.FosterVolunteer:
        return {
          role: CognitoRole.FosterVolunteer,
          user: await this.volunteersService.findByCognitoSubOrFail(
            payload.sub,
          ),
        };
      case CognitoRole.Staff:
        return {
          role: CognitoRole.Staff,
          user: await this.staffService.findByCognitoSubOrFail(payload.sub),
        };
      case CognitoRole.FosterCoordinator:
        return {
          role: CognitoRole.FosterCoordinator,
          user: await this.coordinatorsService.findByCognitoSubOrFail(
            payload.sub,
          ),
        };
      case CognitoRole.Owner:
        return {
          role: CognitoRole.Owner,
          user: await this.ownersService.findByCognitoSubOrFail(payload.sub),
        };
      default:
        throw new ForbiddenException('User does not have an application role');
    }
  }
}
