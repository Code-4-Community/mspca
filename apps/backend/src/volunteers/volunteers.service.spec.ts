import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { Homebase } from '../types';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let repo: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let cognitoService: { createUser: jest.Mock; deleteUser: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    cognitoService = { createUser: jest.fn(), deleteUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: repo,
        },
        {
          provide: CognitoService,
          useValue: cognitoService,
        },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer when one with the id exists', async () => {
      const volunteer = { volunteerId: 7 } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });
  });

  describe('findActiveOrFail', () => {
    it('returns the volunteer when they are active', async () => {
      const volunteer = {
        volunteerId: 7,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      repo.findOne.mockResolvedValue({
        volunteerId: 7,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 7 is not active'),
      );
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
    });
  });

  describe('create', () => {
    const dto: CreateVolunteerDto = {
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '617-555-0100',
      secondaryPhone: '617-555-0199',
      email: 'jane@example.com',
      address: '350 S Huntington Ave',
      city: 'Boston',
      zipcode: '02130',
      homebase: Homebase.BOSTON,
      residentAnimals: 'One cat',
      notes: 'Prefers kittens',
      fosterType: [FosterType.CAT],
    };

    beforeEach(() => {
      repo.findOneBy.mockResolvedValue(null);
      cognitoService.createUser.mockResolvedValue('cognito-sub-123');
      repo.save.mockImplementation(async (volunteer) => ({
        volunteerId: 1,
        ...volunteer,
      }));
    });

    it('creates the Cognito user with the FosterVolunteer role', async () => {
      await service.create(dto);

      expect(cognitoService.createUser).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        role: CognitoRole.FosterVolunteer,
      });
    });

    it('saves the volunteer as pending with a signed waiver and the Cognito sub', async () => {
      const result = await service.create(dto);

      expect(repo.save).toHaveBeenCalledWith({
        ...dto,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
      });
      expect(result).toEqual({
        volunteerId: 1,
        ...dto,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
      });
    });

    it('throws ConflictException without calling Cognito when the email is already in Postgres', async () => {
      repo.findOneBy.mockResolvedValue({ volunteerId: 5 } as FosterVolunteer);

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('A volunteer with this email already exists'),
      );
      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
      expect(cognitoService.createUser).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it.each([
      new ConflictException('A user with this email already exists'),
      new InternalServerErrorException('Failed to create user: boom'),
    ])(
      'propagates %p from Cognito without saving the volunteer',
      async (error) => {
        cognitoService.createUser.mockRejectedValue(error);

        await expect(service.create(dto)).rejects.toBe(error);
        expect(repo.save).not.toHaveBeenCalled();
      },
    );

    it('lowercases the email before checking for duplicates and creating the user', async () => {
      await service.create({ ...dto, email: 'Jane@Example.com' });

      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
      expect(cognitoService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com' }),
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com' }),
      );
    });

    it('deletes the Cognito user and rethrows when the Postgres save fails', async () => {
      const dbError = new Error('connection lost');
      repo.save.mockRejectedValue(dbError);
      cognitoService.deleteUser.mockResolvedValue(undefined);

      await expect(service.create(dto)).rejects.toBe(dbError);
      expect(cognitoService.deleteUser).toHaveBeenCalledWith(
        'jane@example.com',
      );
    });

    it('logs the orphaned Cognito sub and rethrows the save error when the cleanup also fails', async () => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const dbError = new Error('connection lost');
      repo.save.mockRejectedValue(dbError);
      cognitoService.deleteUser.mockRejectedValue(new Error('Cognito down'));

      await expect(service.create(dto)).rejects.toBe(dbError);
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('cognito-sub-123'),
      );

      logError.mockRestore();
    });
  });

  describe('deactivate', () => {
    it('sets status to Inactive, saves, and does not delete the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });

      const result = await service.deactivate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(repo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already inactive', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('sets status to Active and saves the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });

      const result = await service.reactivate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(repo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.reactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already active', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
