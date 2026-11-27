import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArrayOverlap, FindOperator } from 'typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import {
  FosterTraining,
  FosterType,
  VolunteerStatus,
} from './volunteers.types';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { CoordinatorUpdateVolunteerDto } from './dtos/coordinator-update-volunteer.dto';
import { EmailsService } from '../aws/ses/email.service';
import { MatchStatus } from '../matches/matches.types';
import { Match } from '../matches/matches.entity';
import { AnimalsService } from '../animals/animals.service';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Homebase } from '../types';
import { Pet } from '../pets/pets.entity';
import { PetDto } from '../pets/dtos/pet.dto';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
    hasChildren: false,
    childrenAges: [] as number[],
    pets: [] as Pet[],
    assignedCoordinators: [] as FosterCoordinator[],
  } as FosterVolunteer;

  let mockRepo: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  let mockQueryBuilder: {
    leftJoinAndSelect: jest.Mock;
    getMany: jest.Mock;
  };
  let mockCognitoService: {
    signUpUser: jest.Mock;
    confirmUser: jest.Mock;
    deleteUser: jest.Mock;
  };
  let mockCoordinatorsService: { findActiveByHomebase: jest.Mock };
  let emailsService: { sendEmail: jest.Mock };
  let mockAnimalsService: { checkAllExistOrFail: jest.Mock };

  const mockVolunteers = [
    {
      volunteerId: 1,
      firstName: 'Jane',
      lastName: 'Doe',
      fosterType: [FosterType.DOG],
      status: VolunteerStatus.ACTIVE,
    },
    {
      volunteerId: 2,
      firstName: 'John',
      lastName: 'Smith',
      fosterType: [FosterType.CAT],
      status: VolunteerStatus.ACTIVE,
    },
  ] as FosterVolunteer[];

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    mockCognitoService = {
      signUpUser: jest.fn(),
      confirmUser: jest.fn(),
      deleteUser: jest.fn(),
    };
    emailsService = { sendEmail: jest.fn() };
    mockAnimalsService = { checkAllExistOrFail: jest.fn() };
    mockCoordinatorsService = { findActiveByHomebase: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: getRepositoryToken(FosterVolunteer), useValue: mockRepo },
        { provide: CognitoService, useValue: mockCognitoService },
        { provide: EmailsService, useValue: emailsService },
        { provide: AnimalsService, useValue: mockAnimalsService },
        { provide: CoordinatorsService, useValue: mockCoordinatorsService },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer with their coordinators and pets', async () => {
      const volunteer = {
        volunteerId: 7,
        assignedCoordinators: [
          {
            coordinatorId: 3,
            email: 'c3@example.com',
            homebase: Homebase.BOSTON,
            active: true,
          },
        ] as FosterCoordinator[],
        pets: [
          {
            petId: 5,
            volunteerId: 7,
            ageYear: 4,
            ageMonth: 2,
            species: FosterType.DOG,
            breed: 'Lab',
          },
        ] as Pet[],
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinators', 'pets'],
      });
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinators', 'pets'],
      });
    });

    it('removes coordinatorNotes from the returned volunteer', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        coordinatorNotes: 'secret',
      });

      const result = await service.findByIdOrFail(1);

      expect(result).not.toHaveProperty('coordinatorNotes');
    });
  });

  describe('findByCognitoSubOrFail', () => {
    it('returns the volunteer with the matching Cognito sub and their coordinators', async () => {
      const coordinator = {
        coordinatorId: 3,
        firstName: 'Cora',
      } as FosterCoordinator;
      const volunteer = {
        ...mockVolunteer,
        cognitoSub: 'cognito-sub-123',
        assignedCoordinators: [coordinator],
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByCognitoSubOrFail('cognito-sub-123');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { cognitoSub: 'cognito-sub-123' },
        relations: ['assignedCoordinators'],
      });
      expect(result).toBe(volunteer);
      expect(result.assignedCoordinators).toEqual([coordinator]);
    });

    it('throws NotFoundException when no volunteer has the Cognito sub', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByCognitoSubOrFail('unknown-sub'),
      ).rejects.toThrow(new NotFoundException('Volunteer not found'));
    });

    it('throws NotFoundException without querying when the sub is empty', async () => {
      await expect(service.findByCognitoSubOrFail('')).rejects.toThrow(
        new NotFoundException('Volunteer not found'),
      );

      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });
  });
  describe('findActiveOrFail', () => {
    it('returns the volunteer when they are active', async () => {
      const volunteer = {
        volunteerId: 7,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      const checkSpy = jest.spyOn(service, 'checkVolunteerActive');

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
      expect(checkSpy).toHaveBeenCalledWith(volunteer);
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      const volunteer = {
        volunteerId: 7,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      const checkSpy = jest.spyOn(service, 'checkVolunteerActive');

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 7 is not active'),
      );
      expect(checkSpy).toHaveBeenCalledWith(volunteer);
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
      hasChildren: false,
      hasSeparateFosterRoom: true,
      livelyNeighborhood: false,
      notes: 'Prefers kittens',
      fosterType: [FosterType.CAT],
      password: 'Str0ng!Password',
    } as CreateVolunteerDto;

    const { password, ...profile } = dto;

    const bostonCoordinators = [
      {
        coordinatorId: 3,
        email: 'c3@example.com',
        homebase: Homebase.BOSTON,
        active: true,
      },
      {
        coordinatorId: 4,
        email: 'c4@example.com',
        homebase: Homebase.BOSTON,
        active: true,
      },
    ] as FosterCoordinator[];

    beforeEach(() => {
      mockRepo.findOneBy.mockResolvedValue(null);
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue(
        bostonCoordinators,
      );
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
        childrenAges: [],
        pets: [],
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
        assignedCoordinators: bostonCoordinators,
      });
      expect(result).toEqual({
        volunteerId: 1,
        ...profile,
        childrenAges: [],
        pets: [],
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
        assignedCoordinators: bostonCoordinators,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('saves a volunteer with pets and children', async () => {
      const pets = [
        { ageYear: 2, ageMonth: 3, species: FosterType.DOG, breed: 'Beagle' },
        { ageYear: 0, ageMonth: 8, species: FosterType.CAT, breed: 'Tabby' },
      ] as PetDto[];

      const result = await service.create({
        ...dto,
        hasChildren: true,
        childrenAges: [4, 9],
        pets,
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasChildren: true,
          childrenAges: [4, 9],
          pets,
        }),
      );
      expect(result.pets).toEqual(pets);
      expect(result.childrenAges).toEqual([4, 9]);
    });

    it.each([
      [
        true,
        undefined,
        'childrenAges must not be empty when hasChildren is true',
      ],
      [true, [], 'childrenAges must not be empty when hasChildren is true'],
      [false, [3], 'childrenAges must be empty when hasChildren is false'],
    ])(
      'rejects hasChildren %s with childrenAges %j before touching Cognito',
      async (hasChildren, childrenAges, message) => {
        await expect(
          service.create({ ...dto, hasChildren, childrenAges }),
        ).rejects.toThrow(new BadRequestException(message));
        expect(mockRepo.findOneBy).not.toHaveBeenCalled();
        expect(mockCognitoService.signUpUser).not.toHaveBeenCalled();
        expect(mockRepo.save).not.toHaveBeenCalled();
      },
    );

    it('saves the completed trainings given at sign-up', async () => {
      const result = await service.create({
        ...dto,
        completedTrainings: [FosterTraining.DOG, FosterTraining.CAT],
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          completedTrainings: [FosterTraining.DOG, FosterTraining.CAT],
        }),
      );
      expect(result.completedTrainings).toEqual([
        FosterTraining.DOG,
        FosterTraining.CAT,
      ]);
    });
    it("looks up the active coordinators at the volunteer's homebase", async () => {
      await service.create(dto);

      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).toHaveBeenCalledTimes(1);
      expect(mockCoordinatorsService.findActiveByHomebase).toHaveBeenCalledWith(
        Homebase.BOSTON,
      );
    });

    it('saves an empty coordinator list when the homebase has no coordinators', async () => {
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue([]);

      const result = await service.create(dto);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ assignedCoordinators: [] }),
      );
      expect(result.assignedCoordinators).toEqual([]);
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
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('propagates errors from Cognito without saving the volunteer', async () => {
      const error = new ConflictException(
        'A user with this email already exists',
      );
      mockCognitoService.signUpUser.mockRejectedValue(error);

      await expect(service.create(dto)).rejects.toBe(error);
      expect(mockCognitoService.signUpUser).toHaveBeenCalledTimes(1);
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).not.toHaveBeenCalled();
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

    it('deletes the Cognito user and throws InternalServerErrorException when the coordinator lookup fails', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      mockCoordinatorsService.findActiveByHomebase.mockRejectedValue(
        new Error('connection lost'),
      );
      mockCognitoService.deleteUser.mockResolvedValue(undefined);

      await expect(service.create(dto)).rejects.toThrow(
        new InternalServerErrorException('Failed to save the Volunteer'),
      );
      expect(mockCognitoService.deleteUser).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledWith(
        'jane@example.com',
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
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

    it('does not return coordinatorNotes in the saved volunteer', async () => {
      mockRepo.save.mockResolvedValue({
        volunteerId: 1,
        ...profile,
        coordinatorNotes: null,
      });

      const result = await service.create(dto);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ...profile,
          status: VolunteerStatus.PENDING,
          cognitoSub: 'cognito-sub-123',
        }),
      );
      expect(mockRepo.save.mock.calls[0][0]).not.toHaveProperty(
        'coordinatorNotes',
      );
      expect(result).not.toHaveProperty('coordinatorNotes');
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
      expect(mockCognitoService.deleteUser).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('propagates group assignment failures from Cognito without attempting duplicate cleanup', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        volunteerId: 1,
      } as FosterVolunteer);

      const error = new InternalServerErrorException('Failed to confirm user');
      mockCognitoService.confirmUser.mockRejectedValue(error);

      await expect(
        service.confirm({ email: 'jane@example.com', code: '123456' }),
      ).rejects.toBe(error);

      expect(mockCognitoService.confirmUser).toHaveBeenCalledWith(
        'jane@example.com',
        '123456',
        CognitoRole.FosterVolunteer,
      );
      expect(mockCognitoService.deleteUser).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('checkVolunteerActive', () => {
    const makeVolunteer = (status: VolunteerStatus) =>
      ({ volunteerId: 1, status } as FosterVolunteer);

    it('does not throw for an active volunteer', () => {
      expect(() =>
        service.checkVolunteerActive(makeVolunteer(VolunteerStatus.ACTIVE)),
      ).not.toThrow();
    });

    it('throws BadRequestException for a volunteer who is not active', () => {
      expect(() =>
        service.checkVolunteerActive(makeVolunteer(VolunteerStatus.INACTIVE)),
      ).toThrow(new BadRequestException('Volunteer with ID 1 is not active'));
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
        relations: ['assignedCoordinators', 'pets'],
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

    it('never writes coordinatorNotes when saving', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      });
      mockRepo.save.mockImplementation(async (v) => v);

      await service.deactivate(1);

      expect(mockRepo.save.mock.calls[0][0]).not.toHaveProperty(
        'coordinatorNotes',
      );
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
        relations: ['assignedCoordinators', 'pets'],
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

  describe('coordinatorFindByIdOrFail', () => {
    it('returns the full volunteer, including coordinatorNotes', async () => {
      const volunteer = { ...mockVolunteer, coordinatorNotes: 'flagged' };
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.coordinatorFindByIdOrFail(1);

      expect(result).toBe(volunteer);
      expect(result.coordinatorNotes).toBe('flagged');
    });

    it('does not restrict the selected columns', async () => {
      mockRepo.findOne.mockResolvedValue(mockVolunteer);

      await service.coordinatorFindByIdOrFail(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinators', 'pets'],
      });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.coordinatorFindByIdOrFail(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('coordinatorUpdateVolunteerById', () => {
    it('updates coordinatorNotes and returns the volunteer with notes', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        coordinatorNotes: '',
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.coordinatorUpdateVolunteerById(1, {
        coordinatorNotes: 'missed two pickups',
      });

      expect(result.coordinatorNotes).toBe('missed two pickups');
      expect(result.firstName).toBe('Jane');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ coordinatorNotes: 'missed two pickups' }),
      );
    });

    it('updates volunteer-editable fields alongside the notes', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        coordinatorNotes: '',
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const dto: CoordinatorUpdateVolunteerDto = {
        city: 'Boston',
        notes: 'updated notes',
        coordinatorNotes: 'flag',
      } as CoordinatorUpdateVolunteerDto;
      const result = await service.coordinatorUpdateVolunteerById(1, dto);

      expect(result.city).toBe('Boston');
      expect(result.notes).toBe('updated notes');
      expect(result.coordinatorNotes).toBe('flag');
    });

    it('allows clearing the notes with null', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        coordinatorNotes: 'old',
      });
      mockRepo.save.mockImplementation(async (v) => v);
      const dto = { coordinatorNotes: null } as CoordinatorUpdateVolunteerDto;

      const result = await service.coordinatorUpdateVolunteerById(1, dto);

      expect(result.coordinatorNotes).toBeNull();
    });

    it('leaves coordinatorNotes unchanged when only completedTrainings is provided', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        coordinatorNotes: 'keep me',
        completedTrainings: [FosterTraining.DOG],
      });
      mockRepo.save.mockImplementation(async (v) => v);
      const dto = {
        completedTrainings: [FosterTraining.CAT],
      } as CoordinatorUpdateVolunteerDto;

      const result = await service.coordinatorUpdateVolunteerById(1, dto);

      expect(result.coordinatorNotes).toBe('keep me');
      expect(result.completedTrainings).toEqual([FosterTraining.CAT]);
    });

    it('replaces the completed trainings', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        completedTrainings: [FosterTraining.DOG],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.coordinatorUpdateVolunteerById(1, {
        completedTrainings: [FosterTraining.DOG, FosterTraining.CAT],
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          completedTrainings: [FosterTraining.DOG, FosterTraining.CAT],
        }),
      );
      expect(result.completedTrainings).toEqual([
        FosterTraining.DOG,
        FosterTraining.CAT,
      ]);
    });

    it('allows clearing the completed trainings with an empty list', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        completedTrainings: [FosterTraining.DOG],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.coordinatorUpdateVolunteerById(1, {
        completedTrainings: [],
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ completedTrainings: [] }),
      );
      expect(result.completedTrainings).toEqual([]);
    });

    it('throws NotFoundException and saves nothing when the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.coordinatorUpdateVolunteerById(999, { coordinatorNotes: 'x' }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an update that breaks the children rule and saves nothing', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        hasChildren: true,
        childrenAges: [6],
      });

      await expect(
        service.coordinatorUpdateVolunteerById(1, { childrenAges: [] }),
      ).rejects.toThrow(
        new BadRequestException(
          'childrenAges must not be empty when hasChildren is true',
        ),
      );
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('clears the saved children ages when hasChildren is set to false', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        hasChildren: true,
        childrenAges: [6],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.coordinatorUpdateVolunteerById(1, {
        hasChildren: false,
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        hasChildren: false,
        childrenAges: [],
      });
      expect(result.childrenAges).toEqual([]);
    });

    it('replaces the pets list when pets is provided', async () => {
      const newPets = [
        { ageYear: 1, ageMonth: 6, species: FosterType.CAT, breed: 'Siamese' },
        { ageYear: 8, ageMonth: 0, species: FosterType.DOG, breed: 'Beagle' },
      ] as PetDto[];
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        pets: [
          { petId: 5, breed: 'Lab' } as Pet,
          { petId: 6, breed: 'Tabby' } as Pet,
        ],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.coordinatorUpdateVolunteerById(1, {
        pets: newPets,
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        pets: newPets,
      });
      expect(result.pets).toEqual(newPets);
    });
  });

  describe('updateVolunteerById', () => {
    const existingPet = {
      petId: 5,
      volunteerId: 1,
      ageYear: 4,
      ageMonth: 2,
      species: FosterType.DOG,
      breed: 'Lab',
    } as Pet;
    const newPet = {
      ageYear: 1,
      ageMonth: 6,
      species: FosterType.CAT,
      breed: 'Siamese',
    } as PetDto;

    it('replaces the pets list when pets is provided', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        pets: [existingPet],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.updateVolunteerById(1, { pets: [newPet] });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        pets: [newPet],
      });
      const [saved] = mockRepo.save.mock.calls[0];
      expect(saved.pets).not.toContainEqual(existingPet);
      expect(result.pets).toEqual([newPet]);
    });

    it('clears the pets with an empty list', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        pets: [existingPet],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.updateVolunteerById(1, { pets: [] });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        pets: [],
      });
      expect(result.pets).toEqual([]);
    });

    it('leaves the pets unchanged when pets is omitted', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        pets: [existingPet],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.updateVolunteerById(1, { notes: 'x' });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        notes: 'x',
        pets: [existingPet],
      });
      expect(result.pets).toEqual([existingPet]);
    });

    it('adds children with their ages', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.updateVolunteerById(1, {
        hasChildren: true,
        childrenAges: [6],
      });

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        hasChildren: true,
        childrenAges: [6],
      });
      expect(result.hasChildren).toBe(true);
      expect(result.childrenAges).toEqual([6]);
    });

    it.each([
      ['hasChildren false alone', { hasChildren: false }],
      [
        'hasChildren false with empty ages',
        { hasChildren: false, childrenAges: [] },
      ],
    ])('removes children and clears the saved ages with %s', async (_, dto) => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        hasChildren: true,
        childrenAges: [6],
      });
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.updateVolunteerById(1, dto);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        hasChildren: false,
        childrenAges: [],
      });
      expect(result.hasChildren).toBe(false);
      expect(result.childrenAges).toEqual([]);
    });

    it.each([
      [
        'hasChildren false sent with ages',
        { hasChildren: true, childrenAges: [6] },
        { hasChildren: false, childrenAges: [6] },
        'childrenAges must be empty when hasChildren is false',
      ],
      [
        'clearing ages while hasChildren stays true',
        { hasChildren: true, childrenAges: [6] },
        { childrenAges: [] },
        'childrenAges must not be empty when hasChildren is true',
      ],
      [
        'hasChildren true with no ages saved or sent',
        { hasChildren: false, childrenAges: [] },
        { hasChildren: true },
        'childrenAges must not be empty when hasChildren is true',
      ],
      [
        'ages while hasChildren stays false',
        { hasChildren: false, childrenAges: [] },
        { childrenAges: [3] },
        'childrenAges must be empty when hasChildren is false',
      ],
    ])('rejects %s and saves nothing', async (_, saved, dto, message) => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer, ...saved });

      await expect(service.updateVolunteerById(1, dto)).rejects.toThrow(
        new BadRequestException(message),
      );
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should update and return the volunteer with only the given fields changed', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = { notes: 'updated notes' } as UpdateVolunteerDto;
      const result = await service.updateVolunteerById(1, dto);

      expect(result.notes).toBe('updated notes');
      expect(result.firstName).toBe('Jane');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinators', 'pets'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        notes: 'updated notes',
      });
    });

    it('should update multiple allowed fields at once and leave the rest untouched', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        animalUpdates: true,
      });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = {
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
        animalUpdates: false,
      } as UpdateVolunteerDto;

      const result = await service.updateVolunteerById(1, dto);

      expect(result.address).toBe('123 Main St');
      expect(result.city).toBe('Boston');
      expect(result.zipcode).toBe('02115');
      expect(result.animalUpdates).toBe(false);
      expect(result.firstName).toBe('Jane');
      expect(result.notes).toBe('likes cats');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinators', 'pets'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
        animalUpdates: false,
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
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinators', 'pets'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fosterTypePreferences: result }),
      );
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

    it('skips adding an existing preference', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG]),
      );

      const result = await service.updateFosterTypePreferences(1, {
        added: [FosterType.DOG],
      });

      expect(result).toEqual([FosterType.DOG]);
    });

    it('rejects removing nonexistent preferences, even if other removals are valid, without saving or mutating', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG, FosterType.CAT, FosterType.SMALL_ANIMALS],
        }),
      ).rejects.toThrow(
        `Foster types not in the volunteer's preferences: ${FosterType.CAT}, ${FosterType.SMALL_ANIMALS}`,
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

    it('checks for overlapping additions and removals first', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT],
          removed: [FosterType.CAT],
        }),
      ).rejects.toThrow(
        `Foster types cannot be both added and removed: ${FosterType.CAT}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    const pendingVolunteer = () =>
      ({
        volunteerId: 1,
        firstName: 'Jane',
        email: 'jane@example.com',
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer);

    it('sets status to Active, saves, and emails the volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (v) => v);
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      const result = await service.approve(1);

      expect(findSpy).toHaveBeenCalledWith(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VolunteerStatus.ACTIVE }),
      );
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith({
        toEmail: 'jane@example.com',
        subject: expect.any(String),
        bodyHtml: expect.stringContaining('Jane'),
      });
    });

    it('throws ConflictException and does not send an email if the volunteer is not pending', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...pendingVolunteer(),
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.approve(1)).rejects.toThrow(
        new ConflictException('Only pending Volunteers can be approved'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      await expect(service.approve(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(findSpy).toHaveBeenCalledWith(999);
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('still approves the volunteer if the email fails to send', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (v) => v);
      emailsService.sendEmail.mockRejectedValue(new Error('SES down'));
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      const result = await service.approve(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VolunteerStatus.ACTIVE }),
      );
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('deny', () => {
    const pendingVolunteer = () =>
      ({
        volunteerId: 1,
        firstName: 'Jane',
        email: 'jane@example.com',
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer);

    it('deletes the volunteer from Cognito, then from the database', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockCognitoService.deleteUser.mockResolvedValue(undefined);
      mockRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      await service.deny(1);

      expect(findSpy).toHaveBeenCalledWith(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.deleteUser).toHaveBeenCalledWith(
        'jane@example.com',
      );
      expect(mockRepo.delete).toHaveBeenCalledTimes(1);
      expect(mockRepo.delete).toHaveBeenCalledWith({ volunteerId: 1 });
      expect(
        mockCognitoService.deleteUser.mock.invocationCallOrder[0],
      ).toBeLessThan(mockRepo.delete.mock.invocationCallOrder[0]);
    });

    it('throws NotFoundException and deletes nothing if the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deny(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockCognitoService.deleteUser).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException and deletes nothing if the volunteer is not pending', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...pendingVolunteer(),
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.deny(1)).rejects.toThrow(
        new ConflictException('Only pending Volunteers can be denied'),
      );
      expect(mockCognitoService.deleteUser).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('propagates the error and does not touch the database if Cognito fails', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      const cognitoError = new InternalServerErrorException(
        'Failed to delete user: boom',
      );
      mockCognitoService.deleteUser.mockRejectedValue(cognitoError);

      await expect(service.deny(1)).rejects.toBe(cognitoError);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws a PARTIAL DELETION error if the database delete fails after Cognito succeeds', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockCognitoService.deleteUser.mockResolvedValue(undefined);
      mockRepo.delete.mockRejectedValue(new Error('connection lost'));
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      const promise = service.deny(1);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        new InternalServerErrorException(
          'Volunteer: { volunteerId: 1, email: jane@example.com } was deleted from Cognito but not from database',
        ),
      );
      expect(mockCognitoService.deleteUser).toHaveBeenCalledWith(
        'jane@example.com',
      );
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllVolunteers', () => {
    it('should return volunteers with multiple active matches', async () => {
      const matches = [
        {
          matchId: 1,
          volunteerId: 1,
          chameleonAnimalId: '42',
          status: MatchStatus.ACTIVE,
        },
        {
          matchId: 2,
          volunteerId: 1,
          chameleonAnimalId: '55',
          status: MatchStatus.ACTIVE,
        },
      ] as Match[];
      const otherVolunteerMatches = [
        {
          matchId: 3,
          volunteerId: 2,
          chameleonAnimalId: '77',
          status: MatchStatus.ACTIVE,
        },
      ] as Match[];
      const coordinators = [
        {
          coordinatorId: 1,
          email: 'coordinator@mspca.org',
        },
      ] as FosterCoordinator[];
      const volunteers = [
        {
          ...mockVolunteer,
          assignedCoordinators: coordinators,
          matches,
        },
        {
          ...mockVolunteer,
          volunteerId: 2,
          matches: otherVolunteerMatches,
        },
      ] as FosterVolunteer[];

      mockQueryBuilder.getMany.mockResolvedValue(volunteers);

      const result = await service.getAllVolunteers();

      expect(result).toEqual(volunteers);
      expect(result[0].matches).toHaveLength(2);
      expect(result[0].assignedCoordinators).toEqual(coordinators);
      result.forEach((volunteer) => {
        (volunteer.matches ?? []).forEach((match) => {
          expect(match.status).toBe(MatchStatus.ACTIVE);
          expect(match.volunteerId).toBe(volunteer.volunteerId);
        });
      });
      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('volunteer');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'volunteer.assignedCoordinators',
        'coordinator',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'volunteer.pets',
        'pet',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'volunteer.matches',
        'match',
        'match.status = :status',
        { status: MatchStatus.ACTIVE },
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.getMany).toHaveBeenCalledTimes(1);
    });

    it('should not include matches that are not active', async () => {
      const activeMatch = {
        matchId: 1,
        volunteerId: 1,
        chameleonAnimalId: '42',
        status: MatchStatus.ACTIVE,
      } as Match;
      const inactiveMatches = Object.values(MatchStatus)
        .filter((status) => status !== MatchStatus.ACTIVE)
        .map((status, i) => ({
          matchId: i + 2,
          volunteerId: 1,
          chameleonAnimalId: `${100 + i}`,
          status,
        })) as Match[];
      const volunteers = [
        {
          ...mockVolunteer,
          matches: [activeMatch, ...inactiveMatches],
        },
      ] as FosterVolunteer[];

      // Simulate the database applying the join condition passed by the service
      mockQueryBuilder.getMany.mockImplementation(async () => {
        const [, , , params] =
          mockQueryBuilder.leftJoinAndSelect.mock.calls.find(
            ([relation]) => relation === 'volunteer.matches',
          );
        return volunteers.map((volunteer) => ({
          ...volunteer,
          matches: (volunteer.matches ?? []).filter(
            (match) => match.status === params.status,
          ),
        }));
      });

      const result = await service.getAllVolunteers();

      expect(result[0].matches).toEqual([activeMatch]);
    });

    it('should return an empty matches list when a volunteer has no active matches', async () => {
      const volunteers = [
        {
          ...mockVolunteer,
          matches: [],
        } as FosterVolunteer,
      ];

      mockQueryBuilder.getMany.mockResolvedValue(volunteers);

      const result = await service.getAllVolunteers();

      expect(result).toEqual(volunteers);
      expect(result[0].matches).toEqual([]);
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'volunteer.matches',
        'match',
        'match.status = :status',
        { status: MatchStatus.ACTIVE },
      );
    });

    it('should return an empty array when there are no volunteers', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getAllVolunteers();

      expect(result).toEqual([]);
      expect(mockQueryBuilder.getMany).toHaveBeenCalledTimes(1);
    });

    it('removes coordinatorNotes from every returned volunteer', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([
        { ...mockVolunteer, coordinatorNotes: 'a' },
        { ...mockVolunteer, volunteerId: 2, coordinatorNotes: 'b' },
      ]);

      const result = await service.getAllVolunteers();

      result.forEach((volunteer) =>
        expect(volunteer).not.toHaveProperty('coordinatorNotes'),
      );
    });
  });

  describe('changeHomebase', () => {
    const originalSenderEmail = process.env.AWS_SES_SENDER_EMAIL;
    const oldCoordinators = [
      {
        coordinatorId: 1,
        email: 'old1@example.com',
        homebase: Homebase.BOSTON,
        active: true,
      },
      {
        coordinatorId: 2,
        email: 'old2@example.com',
        homebase: Homebase.BOSTON,
        active: true,
      },
    ] as FosterCoordinator[];
    const newCoordinators = [
      {
        coordinatorId: 3,
        email: 'new3@example.com',
        homebase: Homebase.SALEM,
        active: true,
      },
    ] as FosterCoordinator[];

    const makeVolunteer = (
      assignedCoordinators: FosterCoordinator[] = oldCoordinators,
      status: VolunteerStatus = VolunteerStatus.ACTIVE,
    ) =>
      ({
        volunteerId: 9,
        firstName: 'Ada',
        lastName: 'Lovelace',
        homebase: Homebase.BOSTON,
        status,
        assignedCoordinators,
      } as FosterVolunteer);

    beforeEach(() => {
      process.env.AWS_SES_SENDER_EMAIL = 'sender@example.com';
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue(
        newCoordinators,
      );
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);
      emailsService.sendEmail.mockResolvedValue(undefined);
    });

    afterEach(() => {
      if (originalSenderEmail === undefined) {
        delete process.env.AWS_SES_SENDER_EMAIL;
      } else {
        process.env.AWS_SES_SENDER_EMAIL = originalSenderEmail;
      }
    });

    it('saves the new homebase and replaces the coordinator list', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith(9);
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).toHaveBeenCalledTimes(1);
      expect(mockCoordinatorsService.findActiveByHomebase).toHaveBeenCalledWith(
        Homebase.SALEM,
      );
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          volunteerId: 9,
          homebase: Homebase.SALEM,
          assignedCoordinators: newCoordinators,
        }),
      );
      expect(result.homebase).toBe(Homebase.SALEM);
      expect(result.assignedCoordinators).toBe(newCoordinators);
    });

    it('sends one email ccing the old coordinators and one ccing the new coordinators', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          toEmail: 'sender@example.com',
          ccEmails: ['old1@example.com', 'old2@example.com'],
          subject: 'Volunteer moved to another homebase',
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          toEmail: 'sender@example.com',
          ccEmails: ['new3@example.com'],
          subject: 'New volunteer assigned to you',
        }),
      );
    });

    it('names the old and new homebase in the email to the new coordinators', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'New volunteer assigned to you',
          bodyHtml: expect.stringContaining(
            'has moved from the Boston homebase to the Salem homebase',
          ),
        }),
      );
    });

    it('throws NotFoundException and does nothing else when the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.changeHomebase(9, Homebase.SALEM)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 9 not found'),
      );
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws BadRequestException and does nothing else when the volunteer is inactive', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeVolunteer(oldCoordinators, VolunteerStatus.INACTIVE),
      );

      await expect(service.changeHomebase(9, Homebase.SALEM)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 9 is inactive'),
      );
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('lets a pending volunteer change homebase and emails both sets of coordinators', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeVolunteer(oldCoordinators, VolunteerStatus.PENDING),
      );

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(result.homebase).toBe(Homebase.SALEM);
      expect(result.assignedCoordinators).toBe(newCoordinators);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
    });

    it('throws BadRequestException and does nothing else when the homebase is unchanged', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());

      await expect(service.changeHomebase(9, Homebase.BOSTON)).rejects.toThrow(
        new BadRequestException(
          'Volunteer with ID 9 is already assigned to the Boston homebase',
        ),
      );
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('succeeds with an empty list, only emails the old coordinators, and warns when the new homebase has none', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue([]);
      const logWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(result.assignedCoordinators).toEqual([]);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Volunteer moved to another homebase',
        }),
      );
      expect(logWarn).toHaveBeenCalledTimes(1);
      expect(logWarn).toHaveBeenCalledWith(
        'No coordinators to send "New volunteer assigned to you" email to for volunteer 9 (Ada Lovelace).',
      );
    });

    it('only emails the new coordinators and warns when the volunteer had none', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer([]));
      const logWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          ccEmails: ['new3@example.com'],
          subject: 'New volunteer assigned to you',
        }),
      );
      expect(logWarn).toHaveBeenCalledTimes(1);
      expect(logWarn).toHaveBeenCalledWith(
        'No coordinators to send "Volunteer moved to another homebase" email to for volunteer 9 (Ada Lovelace).',
      );
    });

    it('sends no email and warns twice when neither homebase has coordinators', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer([]));
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue([]);
      const logWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.changeHomebase(9, Homebase.SALEM);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(logWarn).toHaveBeenCalledTimes(2);
    });

    it('does not email previously assigned coordinators who are now inactive', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeVolunteer([
          oldCoordinators[0],
          {
            coordinatorId: 4,
            email: 'inactive4@example.com',
            homebase: Homebase.BOSTON,
            active: false,
          },
        ] as FosterCoordinator[]),
      );

      await service.changeHomebase(9, Homebase.SALEM);

      const ccd = emailsService.sendEmail.mock.calls.flatMap(
        ([dto]) => dto.ccEmails,
      );
      expect(ccd).toContain('old1@example.com');
      expect(ccd).not.toContain('inactive4@example.com');
    });

    it('still saves the volunteer, logs the failure, and sends the other email when one send fails', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());
      emailsService.sendEmail
        .mockRejectedValueOnce(new Error('SES is down'))
        .mockResolvedValue(undefined);
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(result.homebase).toBe(Homebase.SALEM);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenLastCalledWith(
        expect.objectContaining({ subject: 'New volunteer assigned to you' }),
      );
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        'Failed to send "Volunteer moved to another homebase" email for volunteer 9 (Ada Lovelace).',
        expect.any(Error),
      );
    });

    it('propagates a save failure without sending any email', async () => {
      const dbError = new Error('connection lost');
      mockRepo.findOne.mockResolvedValue(makeVolunteer());
      mockRepo.save.mockRejectedValue(dbError);

      await expect(service.changeHomebase(9, Homebase.SALEM)).rejects.toBe(
        dbError,
      );
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('updateAnimalPreferences', () => {
    const volunteerWithPreferences = (animalPreferences: string[]) =>
      ({
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
        animalPreferences,
      } as FosterVolunteer);

    beforeEach(() => {
      mockRepo.save.mockImplementation(async (v) => v);
    });

    it('adds the given animal IDs to the list after checking they exist', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences(['A42']));
      const findSpy = jest.spyOn(service, 'findActiveOrFail');

      const result = await service.updateAnimalPreferences(1, {
        added: ['A107', 'A230'],
      });

      expect(findSpy).toHaveBeenCalledWith(1);
      expect(mockAnimalsService.checkAllExistOrFail).toHaveBeenCalledWith([
        'A107',
        'A230',
      ]);
      expect(result).toEqual(['A42', 'A107', 'A230']);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          animalPreferences: ['A42', 'A107', 'A230'],
        }),
      );
    });

    it('removes the given animal IDs from the list without checking that animals exist', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences(['A42', 'A107']),
      );

      const result = await service.updateAnimalPreferences(1, {
        removed: ['A42'],
      });

      expect(mockAnimalsService.checkAllExistOrFail).not.toHaveBeenCalled();
      expect(result).toEqual(['A107']);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ animalPreferences: ['A107'] }),
      );
    });

    it('applies removals and additions in the same request', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences(['A42', 'A107']),
      );

      const result = await service.updateAnimalPreferences(1, {
        added: ['A55'],
        removed: ['A107'],
      });

      expect(mockAnimalsService.checkAllExistOrFail).toHaveBeenCalledWith([
        'A55',
      ]);
      expect(result).toEqual(['A42', 'A55']);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ animalPreferences: ['A42', 'A55'] }),
      );
    });

    // Can't happen through the endpoint, since the DTO's @ArrayUnique rejects
    // duplicate IDs; this checks the service on its own.
    it('does not create duplicates when adding an ID already in the list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences(['A42']));

      const result = await service.updateAnimalPreferences(1, {
        added: ['A42', 'A55', 'A55'],
      });

      expect(result).toEqual(['A42', 'A55']);
    });

    it('throws NotFoundException without saving when an added animal does not exist', async () => {
      const volunteer = volunteerWithPreferences(['A42']);
      mockRepo.findOne.mockResolvedValue(volunteer);
      mockAnimalsService.checkAllExistOrFail.mockRejectedValue(
        new NotFoundException(
          'Animals with Chameleon IDs not found: A998, A999',
        ),
      );

      await expect(
        service.updateAnimalPreferences(1, { added: ['A55', 'A998', 'A999'] }),
      ).rejects.toThrow(
        new NotFoundException(
          'Animals with Chameleon IDs not found: A998, A999',
        ),
      );
      expect(mockAnimalsService.checkAllExistOrFail).toHaveBeenCalledWith([
        'A55',
        'A998',
        'A999',
      ]);
      expect(volunteer.animalPreferences).toEqual(['A42']);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException listing every removed ID that is not in the list', async () => {
      const volunteer = volunteerWithPreferences(['A42']);
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(
        service.updateAnimalPreferences(1, {
          removed: ['A42', 'A998', 'A999'],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          "Animal IDs not in the volunteer's preferences: A998, A999",
        ),
      );
      expect(volunteer.animalPreferences).toEqual(['A42']);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException listing every ID that is in both added and removed', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences(['A42', 'A107']),
      );

      await expect(
        service.updateAnimalPreferences(1, {
          added: ['A42', 'A107', 'A55'],
          removed: ['A42', 'A107'],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Animal IDs cannot be both added and removed: A42, A107',
        ),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException without checking animals when the volunteer is not active', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...volunteerWithPreferences(['A42']),
        status: VolunteerStatus.PENDING,
      });

      await expect(
        service.updateAnimalPreferences(1, { added: ['A55'] }),
      ).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(mockAnimalsService.checkAllExistOrFail).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when removing from an empty list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([]));

      await expect(
        service.updateAnimalPreferences(1, { removed: ['A42'] }),
      ).rejects.toThrow(
        new BadRequestException(
          'Volunteer with ID 1 has no animal preferences to remove',
        ),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException without checking animals if the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const findSpy = jest.spyOn(service, 'findActiveOrFail');

      await expect(
        service.updateAnimalPreferences(999, { added: ['A42'] }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(findSpy).toHaveBeenCalledWith(999);
      expect(mockAnimalsService.checkAllExistOrFail).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findActiveByFosterTypes', () => {
    const inactiveVolunteer = {
      volunteerId: 3,
      firstName: 'Ann',
      lastName: 'Lee',
      fosterType: [FosterType.DOG],
      status: VolunteerStatus.INACTIVE,
    } as FosterVolunteer;

    beforeEach(() => {
      mockRepo.find.mockImplementation(
        ({ where }: { where: Partial<Record<string, unknown>> }) =>
          Promise.resolve(
            [...mockVolunteers, inactiveVolunteer].filter(
              (v) =>
                v.status === where.status &&
                (!where.fosterType ||
                  v.fosterType.some((t) =>
                    (
                      where.fosterType as FindOperator<FosterType[]>
                    ).value.includes(t),
                  )),
            ),
          ),
      );
    });

    it('should return active volunteers matching any of the foster types', async () => {
      const result = await service.findActiveByFosterTypes([
        FosterType.DOG,
        FosterType.CAT,
      ]);

      expect(result).toEqual(mockVolunteers);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          status: VolunteerStatus.ACTIVE,
          fosterType: ArrayOverlap([FosterType.DOG, FosterType.CAT]),
        },
      });
    });

    it('should return only volunteers with a matching foster type', async () => {
      const result = await service.findActiveByFosterTypes([FosterType.CAT]);

      expect(result).toEqual([mockVolunteers[1]]);
    });

    it('should return every active volunteer when no foster types are given', async () => {
      const result = await service.findActiveByFosterTypes([]);

      expect(result).toEqual(mockVolunteers);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { status: VolunteerStatus.ACTIVE },
      });
    });
  });

  describe('incrementAllChildrenAges', () => {
    const volunteerWithChildren = (volunteerId: number, ages: number[]) =>
      ({
        volunteerId,
        hasChildren: true,
        childrenAges: ages,
      } as FosterVolunteer);

    it('loads and updates only volunteers that have children', async () => {
      const volunteers = [
        volunteerWithChildren(1, [2]),
        { volunteerId: 2, hasChildren: false, childrenAges: [] },
        volunteerWithChildren(3, [5]),
      ] as FosterVolunteer[];
      mockRepo.find.mockImplementation(
        ({ where }: { where: Partial<FosterVolunteer> }) =>
          Promise.resolve(
            volunteers.filter(
              (volunteer) => volunteer.hasChildren === where.hasChildren,
            ),
          ),
      );

      await service.incrementAllChildrenAges();

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { hasChildren: true },
      });
      expect(mockRepo.find).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ volunteerId: 1, hasChildren: true }),
        expect.objectContaining({ volunteerId: 3, hasChildren: true }),
      ]);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('adds one year to every child', async () => {
      mockRepo.find.mockResolvedValue([volunteerWithChildren(1, [0, 7, 15])]);

      await service.incrementAllChildrenAges();

      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ volunteerId: 1, childrenAges: [1, 8, 16] }),
      ]);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('updates each volunteer independently', async () => {
      mockRepo.find.mockResolvedValue([
        volunteerWithChildren(1, [2]),
        volunteerWithChildren(2, [5, 9]),
      ]);

      await service.incrementAllChildrenAges();

      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ volunteerId: 1, childrenAges: [3] }),
        expect.objectContaining({ volunteerId: 2, childrenAges: [6, 10] }),
      ]);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('does not save when no volunteer has children', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.incrementAllChildrenAges();

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
