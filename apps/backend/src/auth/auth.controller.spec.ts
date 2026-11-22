import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthController } from './auth.controller';
import { CognitoService } from '../aws/cognito/cognito.service';
import { AccessTokenPayload, CognitoRole } from '../aws/cognito/cognito.types';
import { VolunteersService } from '../volunteers/volunteers.service';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { OwnersService } from '../owners/owners.service';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Owner } from '../owners/owners.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let cognitoService: { getUser: jest.Mock };
  let volunteersService: { findByCognitoSubOrFail: jest.Mock };
  let coordinatorsService: { findByCognitoSubOrFail: jest.Mock };
  let ownersService: { findByCognitoSubOrFail: jest.Mock };
  let warnSpy: jest.SpyInstance;

  const request = {} as Request;
  const volunteer = { volunteerId: 1, firstName: 'Jane' } as FosterVolunteer;
  const coordinator = {
    coordinatorId: 2,
    firstName: 'Cora',
  } as FosterCoordinator;
  const owner = { ownerId: 3, firstName: 'Olive' } as Owner;

  // Builds a verified token payload with the given Cognito groups.
  const payloadWithGroups = (groups?: string[]) =>
    ({
      sub: 'cognito-sub-123',
      'cognito:groups': groups,
      iss: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_TestPool',
      token_use: 'access',
      client_id: 'test-client-id',
      exp: 9999999999,
      iat: 1,
    } as AccessTokenPayload);

  beforeEach(async () => {
    cognitoService = { getUser: jest.fn() };
    volunteersService = { findByCognitoSubOrFail: jest.fn() };
    coordinatorsService = { findByCognitoSubOrFail: jest.fn() };
    ownersService = { findByCognitoSubOrFail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: CognitoService, useValue: cognitoService },
        { provide: VolunteersService, useValue: volunteersService },
        { provide: CoordinatorsService, useValue: coordinatorsService },
        { provide: OwnersService, useValue: ownersService },
      ],
    }).compile();

    controller = module.get(AuthController);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMe', () => {
    it('returns the volunteer for a FosterVolunteer', async () => {
      cognitoService.getUser.mockReturnValue(
        payloadWithGroups([CognitoRole.FosterVolunteer]),
      );
      volunteersService.findByCognitoSubOrFail.mockResolvedValue(volunteer);

      const result = await controller.getMe(request);

      expect(cognitoService.getUser).toHaveBeenCalledWith(request);
      expect(volunteersService.findByCognitoSubOrFail).toHaveBeenCalledWith(
        'cognito-sub-123',
      );
      expect(result).toEqual({
        role: CognitoRole.FosterVolunteer,
        user: volunteer,
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('returns the coordinator for a FosterCoordinator', async () => {
      cognitoService.getUser.mockReturnValue(
        payloadWithGroups([CognitoRole.FosterCoordinator]),
      );
      coordinatorsService.findByCognitoSubOrFail.mockResolvedValue(coordinator);

      const result = await controller.getMe(request);

      expect(coordinatorsService.findByCognitoSubOrFail).toHaveBeenCalledWith(
        'cognito-sub-123',
      );
      expect(result).toEqual({
        role: CognitoRole.FosterCoordinator,
        user: coordinator,
      });
    });

    it('returns the owner for an Owner', async () => {
      cognitoService.getUser.mockReturnValue(
        payloadWithGroups([CognitoRole.Owner]),
      );
      ownersService.findByCognitoSubOrFail.mockResolvedValue(owner);

      const result = await controller.getMe(request);

      expect(ownersService.findByCognitoSubOrFail).toHaveBeenCalledWith(
        'cognito-sub-123',
      );
      expect(result).toEqual({ role: CognitoRole.Owner, user: owner });
    });

    it('uses the least privileged role and logs a warning when the user is in several groups', async () => {
      cognitoService.getUser.mockReturnValue(
        payloadWithGroups([
          CognitoRole.Owner,
          CognitoRole.FosterCoordinator,
          CognitoRole.FosterVolunteer,
        ]),
      );
      volunteersService.findByCognitoSubOrFail.mockResolvedValue(volunteer);

      const result = await controller.getMe(request);

      expect(result.role).toBe(CognitoRole.FosterVolunteer);
      expect(coordinatorsService.findByCognitoSubOrFail).not.toHaveBeenCalled();
      expect(ownersService.findByCognitoSubOrFail).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'User cognito-sub-123 is in multiple groups (FosterVolunteer, FosterCoordinator, Owner); using the least privileged role',
      );
    });

    it('throws UnauthorizedException when no verified user is attached', async () => {
      cognitoService.getUser.mockReturnValue(null);

      await expect(controller.getMe(request)).rejects.toThrow(
        new UnauthorizedException('No user attached to the request'),
      );
      expect(volunteersService.findByCognitoSubOrFail).not.toHaveBeenCalled();
      expect(coordinatorsService.findByCognitoSubOrFail).not.toHaveBeenCalled();
      expect(ownersService.findByCognitoSubOrFail).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the token has no groups', async () => {
      cognitoService.getUser.mockReturnValue(payloadWithGroups(undefined));

      await expect(controller.getMe(request)).rejects.toThrow(
        new ForbiddenException('User does not have an application role'),
      );
    });

    it('throws ForbiddenException when none of the groups are app roles', async () => {
      cognitoService.getUser.mockReturnValue(
        payloadWithGroups(['SomeOtherGroup']),
      );

      await expect(controller.getMe(request)).rejects.toThrow(
        new ForbiddenException('User does not have an application role'),
      );
    });

    it('propagates NotFoundException when no record matches the sub', async () => {
      cognitoService.getUser.mockReturnValue(
        payloadWithGroups([CognitoRole.FosterVolunteer]),
      );
      volunteersService.findByCognitoSubOrFail.mockRejectedValue(
        new NotFoundException('Volunteer not found'),
      );

      await expect(controller.getMe(request)).rejects.toThrow(
        new NotFoundException('Volunteer not found'),
      );
    });
  });
});
