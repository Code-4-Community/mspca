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
import { StaffService } from './staff.service';
import { FosterStaff } from './staff.entity';
import { CreateStaffDto } from './dtos/create-staff.dto';
import { ConfirmStaffDto } from './dtos/confirm-staff.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { Homebase } from '../types';
import { StaffType } from './staff.types';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { EmailsService } from '../aws/ses/email.service';
import { coordinatorGainedStaffEmail } from '../coordinators/emails/coordinatorGainedStaff';
import { staffAssignedCoordinatorsEmail } from './emails/staffAssignedCoordinators';

describe('StaffService', () => {
  let service: StaffService;
  let repo: jest.Mocked<Repository<FosterStaff>>;
  let cognitoService: jest.Mocked<CognitoService>;
  let coordinatorsService: { findActiveByIdsOrFail: jest.Mock };
  let emailsService: { sendEmail: jest.Mock };
  let loggerSpy: jest.SpyInstance;

  const dto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    password: 'Str0ng!Password',
    address: '123 Main St',
    city: 'Boston',
    zipcode: '02101',
    homebase: Homebase.BOSTON,
    notes: null,
    staffType: StaffType.SHELTER,
  } as CreateStaffDto;

  const confirmDto = {
    email: dto.email,
    code: '123456',
  } as ConfirmStaffDto;

  const staff = {
    staffId: 1,
    firstName: dto.firstName,
    lastName: dto.lastName,
    phone: dto.phone,
    secondaryPhone: dto.secondaryPhone,
    email: dto.email,
    address: dto.address,
    city: dto.city,
    zipcode: dto.zipcode,
    homebase: dto.homebase,
    notes: dto.notes,
    staffType: dto.staffType,
    active: true,
    mostRecentWaiverSigned: true,
    cognitoSub: 'cognito-sub-123',
    assignedCoordinators: [],
  } as FosterStaff;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: getRepositoryToken(FosterStaff),
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
        {
          provide: CoordinatorsService,
          useValue: { findActiveByIdsOrFail: jest.fn() },
        },
        {
          provide: EmailsService,
          useValue: { sendEmail: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(StaffService);
    repo = module.get(getRepositoryToken(FosterStaff));
    cognitoService = module.get(CognitoService);
    coordinatorsService = module.get(CoordinatorsService);
    emailsService = module.get(EmailsService);

    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('signs up with Cognito before saving', async () => {
      repo.findOneBy.mockResolvedValue(null);
      cognitoService.signUpUser.mockResolvedValue('cognito-sub-123');
      repo.save.mockResolvedValue(staff);

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
          mostRecentWaiverSigned: true,
          cognitoSub: 'cognito-sub-123',
        }),
      );

      expect(repo.save.mock.calls[0][0]).not.toHaveProperty('password');
      expect(result).toBe(staff);
    });

    it('saves with an empty coordinator list', async () => {
      repo.findOneBy.mockResolvedValue(null);
      cognitoService.signUpUser.mockResolvedValue('cognito-sub-123');
      repo.save.mockResolvedValue(staff);

      await service.create(dto);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ assignedCoordinators: [] }),
      );
    });

    it('rejects duplicate staff members', async () => {
      repo.findOneBy.mockResolvedValue(staff);

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
        `Failed to save staff member ${dto.email}`,
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
        `Failed to save staff member ${dto.email}`,
        databaseError,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        `Created Cognito user sub-123 for ${dto.email}, but failed to save the staff member or delete the Cognito user`,
      );
    });
  });

  describe('confirm', () => {
    it('confirms an existing staff member', async () => {
      repo.findOneBy.mockResolvedValue(staff);
      cognitoService.confirmUser.mockResolvedValue(undefined);

      await expect(service.confirm(confirmDto)).resolves.toBeUndefined();

      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: confirmDto.email,
      });

      expect(cognitoService.confirmUser).toHaveBeenCalledWith(
        confirmDto.email,
        confirmDto.code,
        CognitoRole.Staff,
      );
    });

    it('rejects confirmation when the staff member does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.confirm(confirmDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(cognitoService.confirmUser).not.toHaveBeenCalled();
    });

    it('propagates errors from Cognito', async () => {
      const error = new BadRequestException('Invalid verification code');

      repo.findOneBy.mockResolvedValue(staff);
      cognitoService.confirmUser.mockRejectedValue(error);

      await expect(service.confirm(confirmDto)).rejects.toBe(error);

      expect(cognitoService.confirmUser).toHaveBeenCalledWith(
        confirmDto.email,
        confirmDto.code,
        CognitoRole.Staff,
      );
    });
  });

  describe('findByCognitoSubOrFail', () => {
    it('returns the staff member with the matching Cognito sub', async () => {
      repo.findOne.mockResolvedValue(staff);

      const result = await service.findByCognitoSubOrFail('cognito-sub-123');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { cognitoSub: 'cognito-sub-123' },
        relations: ['assignedCoordinators'],
      });
      expect(result).toBe(staff);
    });

    it('throws NotFoundException when no staff member has the Cognito sub', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.findByCognitoSubOrFail('unknown-sub'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException without querying when the sub is empty', async () => {
      await expect(service.findByCognitoSubOrFail('')).rejects.toThrow(
        NotFoundException,
      );

      expect(repo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('deactivates an active staff member', async () => {
      repo.findOne.mockResolvedValue({ ...staff });
      repo.save.mockImplementation(async (value) => value as FosterStaff);

      const result = await service.deactivate(1);

      expect(result.active).toBe(false);
      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects an already inactive staff member', async () => {
      repo.findOne.mockResolvedValue({
        ...staff,
        active: false,
      });

      await expect(service.deactivate(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('activate', () => {
    it('activates an inactive staff member', async () => {
      repo.findOne.mockResolvedValue({
        ...staff,
        active: false,
      });
      repo.save.mockImplementation(async (value) => value as FosterStaff);

      const result = await service.activate(1);

      expect(result.active).toBe(true);
    });

    it('rejects an already active staff member', async () => {
      repo.findOne.mockResolvedValue({ ...staff });

      await expect(service.activate(1)).rejects.toThrow(BadRequestException);
    });

    it('rejects a missing staff member', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignCoordinators', () => {
    const existingCoordinator = {
      coordinatorId: 1,
      email: 'existing@mspca.org',
      active: true,
    } as FosterCoordinator;

    const newCoordinators = [
      {
        coordinatorId: 2,
        firstName: 'Cora',
        lastName: 'Two',
        email: 'two@mspca.org',
        active: true,
      },
      {
        coordinatorId: 3,
        firstName: 'Cole',
        lastName: 'Three',
        email: 'three@mspca.org',
        active: true,
      },
    ] as FosterCoordinator[];

    it('assigns the coordinators, saves, and emails them and the staff member', async () => {
      repo.findOne.mockResolvedValue({ ...staff, assignedCoordinators: [] });
      coordinatorsService.findActiveByIdsOrFail.mockResolvedValue(
        newCoordinators,
      );
      repo.save.mockImplementation(async (value) => value as FosterStaff);

      const result = await service.assignCoordinators(1, [2, 3]);

      expect(result.assignedCoordinators).toEqual(newCoordinators);
      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { staffId: 1 },
        relations: ['assignedCoordinators'],
      });
      expect(coordinatorsService.findActiveByIdsOrFail).toHaveBeenCalledTimes(
        1,
      );
      expect(coordinatorsService.findActiveByIdsOrFail).toHaveBeenCalledWith([
        2, 3,
      ]);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          staffId: 1,
          assignedCoordinators: newCoordinators,
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(1, {
        toEmail: process.env.AWS_SES_SENDER_EMAIL ?? '',
        ccEmails: ['two@mspca.org', 'three@mspca.org'],
        ...coordinatorGainedStaffEmail(result),
      });
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(2, {
        toEmail: staff.email,
        ...staffAssignedCoordinatorsEmail(staff.firstName, newCoordinators),
      });
      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('keeps existing coordinators and emails only about the new one', async () => {
      repo.findOne.mockResolvedValue({
        ...staff,
        assignedCoordinators: [existingCoordinator],
      });
      coordinatorsService.findActiveByIdsOrFail.mockResolvedValue([
        newCoordinators[0],
      ]);
      repo.save.mockImplementation(async (value) => value as FosterStaff);

      const result = await service.assignCoordinators(1, [2]);

      expect(result.assignedCoordinators).toEqual([
        existingCoordinator,
        newCoordinators[0],
      ]);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          staffId: 1,
          assignedCoordinators: [existingCoordinator, newCoordinators[0]],
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(1, {
        toEmail: process.env.AWS_SES_SENDER_EMAIL ?? '',
        ccEmails: ['two@mspca.org'],
        ...coordinatorGainedStaffEmail(result),
      });
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(2, {
        toEmail: staff.email,
        ...staffAssignedCoordinatorsEmail(staff.firstName, [
          newCoordinators[0],
        ]),
      });
    });

    it('does not save or email when the staff member does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      coordinatorsService.findActiveByIdsOrFail.mockResolvedValue(
        newCoordinators,
      );

      await expect(service.assignCoordinators(999, [2, 3])).rejects.toThrow(
        new NotFoundException('Staff member with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('does not save or email when the staff member is inactive', async () => {
      repo.findOne.mockResolvedValue({ ...staff, active: false });
      coordinatorsService.findActiveByIdsOrFail.mockResolvedValue(
        newCoordinators,
      );

      await expect(service.assignCoordinators(1, [2, 3])).rejects.toThrow(
        new BadRequestException('Staff member with ID 1 is not active'),
      );
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('does not save or email when a coordinator is already assigned', async () => {
      repo.findOne.mockResolvedValue({
        ...staff,
        assignedCoordinators: [existingCoordinator],
      });
      coordinatorsService.findActiveByIdsOrFail.mockResolvedValue([
        existingCoordinator,
        newCoordinators[0],
      ]);

      await expect(service.assignCoordinators(1, [1, 2])).rejects.toThrow(
        new BadRequestException(
          'Coordinators with IDs already assigned to staff member 1: 1',
        ),
      );
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('still emails the staff member and logs when the coordinator email fails', async () => {
      const error = new Error('SES down');
      repo.findOne.mockResolvedValue({ ...staff, assignedCoordinators: [] });
      coordinatorsService.findActiveByIdsOrFail.mockResolvedValue(
        newCoordinators,
      );
      repo.save.mockImplementation(async (value) => value as FosterStaff);
      emailsService.sendEmail
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      const result = await service.assignCoordinators(1, [2, 3]);

      expect(result.assignedCoordinators).toEqual(newCoordinators);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(2, {
        toEmail: staff.email,
        ...staffAssignedCoordinatorsEmail(staff.firstName, newCoordinators),
      });
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to send "New staff member assigned to you" email for staff member: { staffId: 1, coordinatorIds: [2, 3] }',
        error,
      );
    });
  });
});
