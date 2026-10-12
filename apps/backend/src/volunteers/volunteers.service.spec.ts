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
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { Homebase } from '../types';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
    assignedCoordinator: null,
  } as FosterVolunteer;

  let mockRepo: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let mockCognitoService: {
    signUpUser: jest.Mock;
    confirmUser: jest.Mock;
    deleteUser: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    mockCognitoService = {
      signUpUser: jest.fn(),
      confirmUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: getRepositoryToken(FosterVolunteer), useValue: mockRepo },
        { provide: CognitoService, useValue: mockCognitoService },
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
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
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
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      mockRepo.findOne.mockResolvedValue({
        volunteerId: 7,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 7 is not active'),
      );
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
    });
  });

  describe('create', () => {
    const dto = {
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
      fosterType: FosterType.CAT,
      password: 'Str0ng!Password',
    } as CreateVolunteerDto;

    const { password, ...profile } = dto;

    beforeEach(() => {
      mockRepo.findOneBy.mockResolvedValue(null);
      mockCognitoService.signUpUser.mockResolvedValue('cognito-sub-123');
      mockRepo.save.mockImplementation(async (volunteer) => ({
        volunteerId: 1,
        ...volunteer,
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('signs up the Cognito user with their password', async () => {
      await service.create(dto);

      expect(mockCognitoService.signUpUser).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password,
      });
      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('saves the volunteer as pending with a signed waiver and the Cognito sub, without the password', async () => {
      const result = await service.create(dto);

      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...profile,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
      });
      expect(result).toEqual({
        volunteerId: 1,
        ...profile,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException without calling Cognito when the email is already in Postgres', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        volunteerId: 5,
      } as FosterVolunteer);

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('A volunteer with this email already exists'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
      expect(mockCognitoService.signUpUser).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      new ConflictException('A user with this email already exists'),
      new BadRequestException('Password did not conform with policy'),
      new InternalServerErrorException('Failed to sign up user: boom'),
    ])(
      'propagates %p from Cognito without saving the volunteer',
      async (error) => {
        mockCognitoService.signUpUser.mockRejectedValue(error);

        await expect(service.create(dto)).rejects.toBe(error);
        expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
        expect(mockRepo.save).not.toHaveBeenCalled();
        expect(mockCognitoService.deleteUser).not.toHaveBeenCalled();
      },
    );

    it('lowercases the email before checking for duplicates and signing up the user', async () => {
      await service.create({ ...dto, email: 'Jane@Example.com' });

      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
      expect(mockCognitoService.signUpUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com' }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com' }),
      );
      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('logs the save error, deletes the Cognito user, and throws InternalServerErrorException when the save fails', async () => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const dbError = new Error('connection lost');
      mockRepo.save.mockRejectedValue(dbError);
      mockCognitoService.deleteUser.mockResolvedValue(undefined);

      await expect(service.create(dto)).rejects.toThrow(
        new InternalServerErrorException('Failed to save the Volunteer'),
      );
      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledWith(
        'jane@example.com',
      );
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        'Failed to save Volunteer jane@example.com',
        dbError,
      );
    });

    it('also logs the orphaned Cognito sub and still throws InternalServerErrorException when the cleanup fails', async () => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const dbError = new Error('connection lost');
      mockRepo.save.mockRejectedValue(dbError);
      mockCognitoService.deleteUser.mockRejectedValue(
        new Error('Cognito down'),
      );

      await expect(service.create(dto)).rejects.toThrow(
        new InternalServerErrorException('Failed to save the Volunteer'),
      );
      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenCalledWith(
        'Failed to save Volunteer jane@example.com',
        dbError,
      );
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('cognito-sub-123'),
      );
    });
  });

  describe('confirm', () => {
    it('confirms the Cognito user with the FosterVolunteer role when the volunteer exists', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        volunteerId: 1,
      } as FosterVolunteer);
      mockCognitoService.confirmUser.mockResolvedValue(undefined);

      await service.confirm({ email: 'Jane@Example.com', code: '123456' });

      expect(mockRepo.findOneBy).toHaveBeenCalledTimes(1);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
      expect(mockCognitoService.confirmUser).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.confirmUser).toHaveBeenCalledWith(
        'jane@example.com',
        '123456',
        CognitoRole.FosterVolunteer,
      );
    });

    it('throws NotFoundException without calling Cognito when no volunteer has the email', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.confirm({ email: 'jane@example.com', code: '123456' }),
      ).rejects.toThrow(
        new NotFoundException('No volunteer with this email exists'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.confirmUser).not.toHaveBeenCalled();
    });

    it('propagates errors from Cognito', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        volunteerId: 1,
      } as FosterVolunteer);
      const error = new BadRequestException('Invalid verification code');
      mockCognitoService.confirmUser.mockRejectedValue(error);

      await expect(
        service.confirm({ email: 'jane@example.com', code: '000000' }),
      ).rejects.toBe(error);
      expect(mockCognitoService.confirmUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('deactivate', () => {
    it('sets status to Inactive, saves, and does not delete the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });

      const result = await service.deactivate(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already inactive', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('sets status to Active and saves the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });

      const result = await service.reactivate(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.reactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already active', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getVolunteerById', () => {
    it('should return a volunteer when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockVolunteer);

      const result = await service.getVolunteerById(1);

      expect(result).toEqual(mockVolunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getVolunteerById(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 999 },
        relations: ['assignedCoordinator'],
      });
    });
  });

  describe('updateVolunteerById', () => {
    it('should update and return the volunteer with only the given fields changed', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = { notes: 'updated notes' } as UpdateVolunteerDto;
      const result = await service.updateVolunteerById(1, dto);

      expect(result.notes).toBe('updated notes');
      expect(result.firstName).toBe('Jane');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        notes: 'updated notes',
      });
    });

    it('should update multiple allowed fields at once', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = {
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
      } as UpdateVolunteerDto;

      const result = await service.updateVolunteerById(1, dto);

      expect(result.address).toBe('123 Main St');
      expect(result.city).toBe('Boston');
      expect(result.zipcode).toBe('02115');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
      });
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVolunteerById(999, { notes: 'x' }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
