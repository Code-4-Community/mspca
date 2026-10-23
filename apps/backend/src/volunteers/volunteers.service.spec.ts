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
import { EmailsService } from '../aws/ses/email.service';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '123-456-7890',
    secondaryPhone: null,
    email: 'jane@example.com',
    address: '123 Main St',
    city: 'Boston',
    zipcode: '02115',
    homebase: Homebase.BOSTON,
    residentAnimals: 'Cats',
    fosterType: FosterType.CAT,
    completedCanineTraining: null,
    mostRecentWaiverSigned: true,
    status: VolunteerStatus.ACTIVE,
    fosterTypePreferences: [FosterType.CAT],
    assignedCoordinator: null,
    notes: 'Likes cats',
  } as FosterVolunteer;

  let mockRepo: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  let mockCognitoService: {
    signUpUser: jest.Mock;
    confirmUser: jest.Mock;
    addUserToGroup: jest.Mock;
    deleteUser: jest.Mock;
  };

  let emailsService: {
    sendEmail: jest.Mock;
  };

  const mockVolunteers = [
    { volunteerId: 1, firstName: 'Jane', lastName: 'Doe' },
    { volunteerId: 2, firstName: 'John', lastName: 'Smith' },
  ] as FosterVolunteer[];

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockCognitoService = {
      signUpUser: jest.fn(),
      confirmUser: jest.fn(),
      addUserToGroup: jest.fn(),
      deleteUser: jest.fn(),
    };

    emailsService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: getRepositoryToken(FosterVolunteer), useValue: mockRepo },
        { provide: CognitoService, useValue: mockCognitoService },
        { provide: EmailsService, useValue: emailsService },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockVolunteer);

      const result = await service.findByIdOrFail(1);

      expect(result).toBe(mockVolunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when the volunteer is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('findActiveOrFail', () => {
    it('returns an active volunteer', async () => {
      const volunteer = {
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;

      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(1);

      expect(result).toBe(volunteer);
    });

    it('rejects an inactive volunteer', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.INACTIVE,
      });

      await expect(service.findActiveOrFail(1)).rejects.toThrow(
        BadRequestException,
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

    it('signs up the Cognito user and saves the volunteer as pending with a signed waiver and the Cognito sub, without the password', async () => {
      const result = await service.create(dto);

      expect(mockRepo.findOneBy).toHaveBeenCalledTimes(1);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.signUpUser).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password,
      });
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

    it('propagates errors from Cognito without saving the volunteer', async () => {
      const error = new ConflictException(
        'A user with this email already exists',
      );
      mockCognitoService.signUpUser.mockRejectedValue(error);

      await expect(service.create(dto)).rejects.toBe(error);
      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockCognitoService.deleteUser).not.toHaveBeenCalled();
    });

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
        'Created Cognito user cognito-sub-123 for jane@example.com but failed to save the Volunteer or delete the Cognito user',
      );
    });
  });

  describe('confirm', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('confirms the Cognito user and adds the FosterVolunteer role when the volunteer exists', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        volunteerId: 1,
      } as FosterVolunteer);
      mockCognitoService.confirmUser.mockResolvedValue(undefined);
      mockCognitoService.addUserToGroup.mockResolvedValue(undefined);

      await service.confirm({ email: 'Jane@Example.com', code: '123456' });

      expect(mockRepo.findOneBy).toHaveBeenCalledTimes(1);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        email: 'jane@example.com',
      });
      expect(mockCognitoService.confirmUser).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.confirmUser).toHaveBeenCalledWith(
        'jane@example.com',
        '123456',
      );
      expect(mockCognitoService.addUserToGroup).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.addUserToGroup).toHaveBeenCalledWith(
        'jane@example.com',
        CognitoRole.FosterVolunteer,
      );
      expect(mockCognitoService.deleteUser).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
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
      expect(mockCognitoService.addUserToGroup).not.toHaveBeenCalled();
    });

    it('deletes the Cognito user and the volunteer when adding the role fails', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        volunteerId: 1,
      } as FosterVolunteer);
      mockCognitoService.confirmUser.mockResolvedValue(undefined);
      mockCognitoService.addUserToGroup.mockRejectedValue(
        new InternalServerErrorException(
          'Failed to add user to group FosterVolunteer',
        ),
      );
      mockCognitoService.deleteUser.mockResolvedValue(undefined);
      mockRepo.delete.mockResolvedValue({ affected: 1 });
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await expect(
        service.confirm({ email: 'jane@example.com', code: '123456' }),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to confirm the Volunteer'),
      );
      expect(mockCognitoService.addUserToGroup).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledWith(
        'jane@example.com',
      );
      expect(mockRepo.delete).toHaveBeenCalledTimes(1);
      expect(mockRepo.delete).toHaveBeenCalledWith({ volunteerId: 1 });
      expect(logError).not.toHaveBeenCalled();
    });

    it('logs and still throws when adding the role and both deletes fail', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        volunteerId: 1,
      } as FosterVolunteer);
      mockCognitoService.confirmUser.mockResolvedValue(undefined);
      mockCognitoService.addUserToGroup.mockRejectedValue(
        new InternalServerErrorException(
          'Failed to add user to group FosterVolunteer',
        ),
      );
      mockCognitoService.deleteUser.mockRejectedValue(
        new InternalServerErrorException('Failed to delete user'),
      );
      const dbError = new Error('DB down');
      mockRepo.delete.mockRejectedValue(dbError);
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await expect(
        service.confirm({ email: 'jane@example.com', code: '123456' }),
      ).rejects.toThrow(
        new InternalServerErrorException('Failed to confirm the Volunteer'),
      );
      expect(mockCognitoService.deleteUser).toHaveBeenCalledTimes(1);
      expect(mockRepo.delete).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenCalledWith(
        'Failed to delete Cognito user jane@example.com after adding the role failed',
      );
      expect(logError).toHaveBeenCalledWith(
        'Failed to delete Volunteer 1 after adding the role failed',
        dbError,
      );
    });
  });

  describe('checkVolunteerActive', () => {
    it('does not throw for an active volunteer', () => {
      expect(() =>
        service.checkVolunteerActive({
          ...mockVolunteer,
          status: VolunteerStatus.ACTIVE,
        }),
      ).not.toThrow();
    });

    it('throws for an inactive volunteer', () => {
      expect(() =>
        service.checkVolunteerActive({
          ...mockVolunteer,
          status: VolunteerStatus.INACTIVE,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('deactivate', () => {
    it('deactivates an active volunteer', async () => {
      const volunteer = {
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      };

      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.deactivate(1);

      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.INACTIVE,
        }),
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a nonexistent volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(NotFoundException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a volunteer who is not active', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.INACTIVE,
      });

      await expect(service.deactivate(1)).rejects.toThrow(BadRequestException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('reactivates an inactive volunteer', async () => {
      const volunteer = {
        ...mockVolunteer,
        status: VolunteerStatus.INACTIVE,
      };

      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.reactivate(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.ACTIVE,
        }),
      );
    });

    it('throws NotFoundException for a nonexistent volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.reactivate(999)).rejects.toThrow(NotFoundException);
    });

    it('rejects a volunteer who is not inactive', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.reactivate(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateVolunteerById', () => {
    it('updates and saves the volunteer', async () => {
      const dto = {
        notes: 'Updated notes',
      } as UpdateVolunteerDto;

      const updated = {
        ...mockVolunteer,
        ...dto,
      };

      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.updateVolunteerById(1, dto);

      expect(result).toEqual(updated);
      expect(mockRepo.save).toHaveBeenCalledWith(updated);
    });

    it('throws NotFoundException when the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVolunteerById(999, {
          notes: 'Updated notes',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateFosterTypePreferences', () => {
    const volunteerWithPreferences = (
      fosterTypePreferences: FosterType[],
      status: VolunteerStatus = VolunteerStatus.ACTIVE,
    ): FosterVolunteer => ({
      ...mockVolunteer,
      status,
      fosterTypePreferences,
    });

    beforeEach(() => {
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);
    });

    it('adds new foster types to the existing list', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        added: [FosterType.CAT, FosterType.SMALL_ANIMALS],
      });
      expect(result).toEqual([
        FosterType.DOG,
        FosterType.CAT,
        FosterType.SMALL_ANIMALS,
      ]);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fosterTypePreferences: result }),
      );
    });

    it('adds a preference to an empty list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([]));
      const result = await service.updateFosterTypePreferences(1, {
        added: [FosterType.DOG],
      });
      expect(result).toEqual([FosterType.DOG]);
    });

    it('removes an existing preference', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([
          FosterType.DOG,
          FosterType.CAT,
          FosterType.SMALL_ANIMALS,
        ]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        removed: [FosterType.CAT, FosterType.SMALL_ANIMALS],
      });
      expect(result).toEqual([FosterType.DOG]);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fosterTypePreferences: [FosterType.DOG] }),
      );
    });

    it('removes all existing preferences', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG, FosterType.CAT]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        removed: [FosterType.DOG, FosterType.CAT],
      });
      expect(result).toEqual([]);
    });

    it('applies valid removals and additions together', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG, FosterType.CAT]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        added: [FosterType.BABY_BOTTLE_ANIMALS],
        removed: [FosterType.DOG],
      });
      expect(result).toEqual([FosterType.CAT, FosterType.BABY_BOTTLE_ANIMALS]);
    });

    it('rejects adding an existing preference without saving or mutating', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
        }),
      ).rejects.toThrow(
        `Foster type preferences already exist: ${FosterType.DOG}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects duplicate additions in the same request', async () => {
      const volunteer = volunteerWithPreferences([]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT, FosterType.CAT],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(volunteer.fosterTypePreferences).toEqual([]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects removing a nonexistent preference without saving or mutating', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.CAT],
        }),
      ).rejects.toThrow(
        `Foster types not in the volunteer's preferences: ${FosterType.CAT}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects removing from an empty preference list', async () => {
      const volunteer = volunteerWithPreferences([]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG],
        }),
      ).rejects.toThrow(
        'Volunteer with ID 1 has no foster type preferences to remove',
      );
      expect(volunteer.fosterTypePreferences).toEqual([]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('reports multiple invalid removals together', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.CAT, FosterType.SMALL_ANIMALS],
        }),
      ).rejects.toThrow(
        `Foster types not in the volunteer's preferences: ${FosterType.CAT}, ${FosterType.SMALL_ANIMALS}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid removal even if other removals are valid', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG, FosterType.CAT],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects overlapping additions and removals', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
          removed: [FosterType.DOG],
        }),
      ).rejects.toThrow(
        `Foster types cannot be both added and removed: ${FosterType.DOG}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it.each([VolunteerStatus.PENDING, VolunteerStatus.INACTIVE])(
      'rejects a volunteer with status %s',
      async (status) => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithPreferences([FosterType.DOG], status),
        );
        await expect(
          service.updateFosterTypePreferences(1, {
            added: [FosterType.CAT],
          }),
        ).rejects.toThrow('Volunteer with ID 1 is not active');
        expect(mockRepo.save).not.toHaveBeenCalled();
      },
    );

    it('throws NotFoundException for a nonexistent volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateFosterTypePreferences(999, {
          added: [FosterType.DOG],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an empty update', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG]),
      );
      await expect(service.updateFosterTypePreferences(1, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('propagates database save errors', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([]));
      mockRepo.save.mockRejectedValue(new Error('db failure'));
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
        }),
      ).rejects.toThrow('db failure');
    });
  });

  describe('approve', () => {
    const pendingVolunteer = (): FosterVolunteer => ({
      ...mockVolunteer,
      status: VolunteerStatus.PENDING,
    });

    it('approves a pending volunteer and sends an email', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);

      const result = await service.approve(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.ACTIVE,
        }),
      );

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'jane@example.com',
        }),
      );
    });

    it('throws ConflictException if the volunteer is not pending', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.approve(1)).rejects.toThrow(ConflictException);

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.approve(999)).rejects.toThrow(NotFoundException);

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('keeps the approval if sending the email fails', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);
      emailsService.sendEmail.mockRejectedValue(new Error('SES down'));

      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      const result = await service.approve(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.ACTIVE,
        }),
      );
      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });

  describe('getAllVolunteers', () => {
    it('returns all volunteers', async () => {
      mockRepo.find.mockResolvedValue(mockVolunteers);

      const result = await service.getAllVolunteers();

      expect(result).toEqual(mockVolunteers);
      expect(mockRepo.find).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when no volunteers exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getAllVolunteers();

      expect(result).toEqual([]);
    });
  });
});