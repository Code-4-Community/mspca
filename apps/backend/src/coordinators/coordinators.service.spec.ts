import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { ConfirmCoordinatorDto } from './dtos/confirm-coordinator.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { Homebase } from '../types';

describe('CoordinatorsService', () => {
  let service: CoordinatorsService;
  let repo: jest.Mocked<Repository<FosterCoordinator>>;
  let cognitoService: jest.Mocked<CognitoService>;
  let loggerSpy: jest.SpyInstance;

  const dto: CreateCoordinatorDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    password: 'Str0ng!Password',
    homebase: Homebase.BOSTON,
  };

  const confirmDto: ConfirmCoordinatorDto = {
    email: dto.email,
    code: '123456',
  };

  const coordinator = {
    coordinatorId: 1,
    firstName: dto.firstName,
    lastName: dto.lastName,
    phone: dto.phone,
    secondaryPhone: dto.secondaryPhone,
    email: dto.email,
    homebase: dto.homebase,
    active: true,
    cognitoSub: 'cognito-sub-123',
    assignedVolunteers: [],
  } as FosterCoordinator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoordinatorsService,
        {
          provide: getRepositoryToken(FosterCoordinator),
          useValue: {
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: CognitoService,
          useValue: {
            signUpUser: jest.fn(),
            confirmUser: jest.fn(),
            deleteUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CoordinatorsService);
    repo = module.get(getRepositoryToken(FosterCoordinator));
    cognitoService = module.get(CognitoService);

    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('signs up with Cognito before saving', async () => {
      repo.findOneBy.mockResolvedValue(null);
      cognitoService.signUpUser.mockResolvedValue('cognito-sub-123');
      repo.save.mockResolvedValue(coordinator);

      const result = await service.create(dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: dto.email,
      });

      expect(cognitoService.signUpUser).toHaveBeenCalledWith({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: dto.password,
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          active: true,
          cognitoSub: 'cognito-sub-123',
        }),
      );

      expect(repo.save.mock.calls[0][0]).not.toHaveProperty('password');
      expect(result).toBe(coordinator);
    });

    it('rejects duplicate coordinators', async () => {
      repo.findOneBy.mockResolvedValue(coordinator);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);

      expect(cognitoService.signUpUser).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does not save if Cognito sign-up fails', async () => {
      repo.findOneBy.mockResolvedValue(null);
      cognitoService.signUpUser.mockRejectedValue(
        new ConflictException('Cognito user already exists'),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('deletes the Cognito user when saving fails and logs the error', async () => {
      const databaseError = new Error('Database error');

      repo.findOneBy.mockResolvedValue(null);
      cognitoService.signUpUser.mockResolvedValue('sub-123');
      repo.save.mockRejectedValue(databaseError);
      cognitoService.deleteUser.mockResolvedValue(undefined);

      await expect(service.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(cognitoService.deleteUser).toHaveBeenCalledWith(dto.email);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to save coordinator ${dto.email}`,
        databaseError,
      );
    });

    it('returns a server error and logs when Cognito cleanup fails', async () => {
      const databaseError = new Error('Database error');
      const cleanupError = new Error('Cleanup failed');

      repo.findOneBy.mockResolvedValue(null);
      cognitoService.signUpUser.mockResolvedValue('sub-123');
      repo.save.mockRejectedValue(databaseError);
      cognitoService.deleteUser.mockRejectedValue(cleanupError);

      await expect(service.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(cognitoService.deleteUser).toHaveBeenCalledWith(dto.email);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to save coordinator ${dto.email}`,
        databaseError,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        `Created Cognito user sub-123 for ${dto.email}, but failed to save the coordinator or delete the Cognito user`,
      );
    });
  });

  describe('confirm', () => {
    it('confirms an existing coordinator', async () => {
      repo.findOneBy.mockResolvedValue(coordinator);
      cognitoService.confirmUser.mockResolvedValue(undefined);

      await expect(service.confirm(confirmDto)).resolves.toBeUndefined();

      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: confirmDto.email,
      });

      expect(cognitoService.confirmUser).toHaveBeenCalledWith(
        confirmDto.email,
        confirmDto.code,
        CognitoRole.FosterCoordinator,
      );
    });

    it('rejects confirmation when the coordinator does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.confirm(confirmDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(cognitoService.confirmUser).not.toHaveBeenCalled();
    });

    it('propagates an invalid verification code error', async () => {
      const error = new BadRequestException('Invalid verification code');

      repo.findOneBy.mockResolvedValue(coordinator);
      cognitoService.confirmUser.mockRejectedValue(error);

      await expect(service.confirm(confirmDto)).rejects.toBe(error);

      expect(cognitoService.confirmUser).toHaveBeenCalledWith(
        confirmDto.email,
        confirmDto.code,
        CognitoRole.FosterCoordinator,
      );
    });

    it('propagates an expired verification code error', async () => {
      const error = new BadRequestException('Verification code expired');

      repo.findOneBy.mockResolvedValue(coordinator);
      cognitoService.confirmUser.mockRejectedValue(error);

      await expect(service.confirm(confirmDto)).rejects.toBe(error);
    });

    it('propagates Cognito server errors', async () => {
      const error = new InternalServerErrorException('Failed to confirm user');

      repo.findOneBy.mockResolvedValue(coordinator);
      cognitoService.confirmUser.mockRejectedValue(error);

      await expect(service.confirm(confirmDto)).rejects.toBe(error);
    });
  });

  describe('deactivate', () => {
    it('deactivates an active coordinator', async () => {
      repo.findOne.mockResolvedValue({ ...coordinator });
      repo.save.mockImplementation(async (value) => value as FosterCoordinator);

      const result = await service.deactivate(1);

      expect(result.active).toBe(false);
      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects an already inactive coordinator', async () => {
      repo.findOne.mockResolvedValue({
        ...coordinator,
        active: false,
      });

      await expect(service.deactivate(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('activate', () => {
    it('activates an inactive coordinator', async () => {
      repo.findOne.mockResolvedValue({
        ...coordinator,
        active: false,
      });
      repo.save.mockImplementation(async (value) => value as FosterCoordinator);

      const result = await service.activate(1);

      expect(result.active).toBe(true);
    });

    it('rejects an already active coordinator', async () => {
      repo.findOne.mockResolvedValue({ ...coordinator });

      await expect(service.activate(1)).rejects.toThrow(BadRequestException);
    });

    it('rejects a missing coordinator', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(NotFoundException);
    });
  });
});
