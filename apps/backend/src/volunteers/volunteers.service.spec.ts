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
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { FosterCoordinator } from '../coordinators/coordinators.entity';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
    assignedCoordinators: [],
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
    deleteUser: jest.Mock;
  };
  let mockCoordinatorsService: { findActiveByHomebase: jest.Mock };
  let emailsService: { sendEmail: jest.Mock };

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
      deleteUser: jest.fn(),
    };
    emailsService = { sendEmail: jest.fn() };
    mockCoordinatorsService = { findActiveByHomebase: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: getRepositoryToken(FosterVolunteer), useValue: mockRepo },
        { provide: CognitoService, useValue: mockCognitoService },
        { provide: EmailsService, useValue: emailsService },
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
    it('returns the volunteer when one with the id exists', async () => {
      const volunteer = { volunteerId: 7 } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinators'],
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
        relations: ['assignedCoordinators'],
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
      residentAnimals: 'One cat',
      notes: 'Prefers kittens',
      fosterType: FosterType.CAT,
      password: 'Str0ng!Password',
    } as CreateVolunteerDto;

    const { password, ...profile } = dto;

    const bostonCoordinators = [
      { coordinatorId: 3, email: 'c3@example.com', active: true },
      { coordinatorId: 4, email: 'c4@example.com', active: true },
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

    it('signs up the Cognito user with their password', async () => {
      await service.create(dto);

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
        assignedCoordinators: bostonCoordinators,
      });
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
        assignedCoordinators: bostonCoordinators,
      });
      expect(result).toEqual({
        volunteerId: 1,
        ...profile,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
        assignedCoordinators: bostonCoordinators,
      });
      expect(result).not.toHaveProperty('password');
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

    it('does not create the Cognito user when the coordinator lookup fails', async () => {
      const lookupError = new Error('connection lost');
      mockCoordinatorsService.findActiveByHomebase.mockRejectedValue(
        lookupError,
      );

      await expect(service.create(dto)).rejects.toBe(lookupError);
      expect(mockRepo.findOneBy).toHaveBeenCalledTimes(1);
      expect(
        mockCoordinatorsService.findActiveByHomebase,
      ).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.signUpUser).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
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
        relations: ['assignedCoordinators'],
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
        relations: ['assignedCoordinators'],
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
        relations: ['assignedCoordinators'],
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
        relations: ['assignedCoordinators'],
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

  describe('getAllVolunteers', () => {
    it('should return all volunteers', async () => {
      mockRepo.find.mockResolvedValue(mockVolunteers);

      const result = await service.getAllVolunteers();

      expect(result).toEqual(mockVolunteers);
      expect(mockRepo.find).toHaveBeenCalled();
    });

    it('should return an empty array when there are no volunteers', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getAllVolunteers();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalled();
    });
  });

  describe('changeHomebase', () => {
    const oldCoordinators = [
      { coordinatorId: 1, email: 'old1@example.com', active: true },
      { coordinatorId: 2, email: 'old2@example.com', active: true },
    ] as FosterCoordinator[];
    const newCoordinators = [
      { coordinatorId: 3, email: 'new3@example.com', active: true },
    ] as FosterCoordinator[];

    const makeVolunteer = (
      assignedCoordinators: FosterCoordinator[] = oldCoordinators,
    ) =>
      ({
        volunteerId: 9,
        firstName: 'Ada',
        lastName: 'Lovelace',
        homebase: Homebase.BOSTON,
        assignedCoordinators,
      } as FosterVolunteer);

    beforeEach(() => {
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue(
        newCoordinators,
      );
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);
      emailsService.sendEmail.mockResolvedValue(undefined);
    });

    it('saves the new homebase and replaces the coordinator list', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 9 },
        relations: ['assignedCoordinators'],
      });
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

    it('emails the old coordinators and the new coordinators', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          toEmail: 'old1@example.com',
          subject: 'Volunteer moved to another homebase',
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          toEmail: 'old2@example.com',
          subject: 'Volunteer moved to another homebase',
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          toEmail: 'new3@example.com',
          subject: 'New volunteer assigned to you',
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

    it('succeeds with an empty list and only emails the old coordinators when the new homebase has none', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue([]);

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(result.assignedCoordinators).toEqual([]);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'New volunteer assigned to you' }),
      );
    });

    it('only emails the new coordinators when the volunteer had none', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer([]));

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'new3@example.com',
          subject: 'New volunteer assigned to you',
        }),
      );
    });

    it('sends no email when neither homebase has coordinators', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer([]));
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue([]);

      await service.changeHomebase(9, Homebase.SALEM);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('does not email previously assigned coordinators who are now inactive', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeVolunteer([
          { coordinatorId: 1, email: 'old1@example.com', active: false },
        ] as FosterCoordinator[]),
      );

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'new3@example.com' }),
      );
    });

    it('keeps and does not email a coordinator who is in both the old and new lists', async () => {
      const stays = {
        coordinatorId: 5,
        email: 'stays@example.com',
        active: true,
      } as FosterCoordinator;
      mockRepo.findOne.mockResolvedValue(
        makeVolunteer([oldCoordinators[0], stays]),
      );
      mockCoordinatorsService.findActiveByHomebase.mockResolvedValue([
        stays,
        newCoordinators[0],
      ]);

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(result.assignedCoordinators).toEqual([stays, newCoordinators[0]]);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'stays@example.com' }),
      );
    });

    it('still returns the saved volunteer and emails the rest when one send fails', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());
      emailsService.sendEmail
        .mockRejectedValueOnce(new Error('SES is down'))
        .mockResolvedValue(undefined);
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(result.homebase).toBe(Homebase.SALEM);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('coordinator 1'),
        expect.any(String),
      );
    });

    it('still returns the saved volunteer and logs each failure when every send fails', async () => {
      mockRepo.findOne.mockResolvedValue(makeVolunteer());
      emailsService.sendEmail.mockRejectedValue(new Error('SES is down'));
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(result.homebase).toBe(Homebase.SALEM);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);
      expect(logError).toHaveBeenCalledTimes(3);
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
});
