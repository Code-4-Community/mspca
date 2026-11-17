import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { VolunteersService } from '../volunteers/volunteers.service';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { OwnersService } from '../owners/owners.service';
import { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly volunteersService: VolunteersService,
    private readonly coordinatorsService: CoordinatorsService,
    private readonly ownersService: OwnersService,
  ) {}

  /**
   * Returns the signed-in user, looked up by the Cognito sub in their token.
   *
   * The user's Cognito groups decide which table they're looked up in. A user
   * in several groups gets their highest role: Owner, then FosterCoordinator,
   * then FosterVolunteer.
   *
   * @param req - The request, after CognitoJWTGuard has verified its token.
   * @returns The user's role and their record.
   * @throws {UnauthorizedException} If no verified user is attached to the request.
   * @throws {ForbiddenException} If the user is in none of the app's groups.
   * @throws {NotFoundException} If no record matches the user's Cognito sub.
   */
  @Get('me')
  async getMe(@Req() req: Request): Promise<AuthenticatedUser> {
    const payload = this.cognitoService.getUser(req);
    if (!payload) {
      throw new UnauthorizedException();
    }

    const groups = payload['cognito:groups'] ?? [];

    if (groups.includes(CognitoRole.Owner)) {
      return {
        role: CognitoRole.Owner,
        user: await this.ownersService.findByCognitoSubOrFail(payload.sub),
      };
    }

    if (groups.includes(CognitoRole.FosterCoordinator)) {
      return {
        role: CognitoRole.FosterCoordinator,
        user: await this.coordinatorsService.findByCognitoSubOrFail(
          payload.sub,
        ),
      };
    }

    if (groups.includes(CognitoRole.FosterVolunteer)) {
      return {
        role: CognitoRole.FosterVolunteer,
        user: await this.volunteersService.findByCognitoSubOrFail(payload.sub),
      };
    }

    throw new ForbiddenException('User does not have an application role');
  }
}
