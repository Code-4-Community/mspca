import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { VolunteerStatus } from '../volunteers/volunteers.types';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { VolunteersService } from '../volunteers/volunteers.service';
import { EmailsService } from '../aws/ses/email.service';
import { SendEmailDTO } from '../aws/ses/sendEmail.dto';

const coordinator = {
  coordinatorId: 7,
  email: 'coordinator@gmail.com',
  active: true,
} as FosterCoordinator;

const secondCoordinator = {
  coordinatorId: 8,
  email: 'second-coordinator@gmail.com',
  active: true,
} as FosterCoordinator;

const inactiveCoordinator = {
  coordinatorId: 9,
  email: 'inactive-coordinator@gmail.com',
  active: false,
} as FosterCoordinator;

const volunteerWithCoordinator = {
  volunteerId: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  status: VolunteerStatus.ACTIVE,
  assignedCoordinators: [coordinator],
} as FosterVolunteer;

const volunteerWithCoordinators = {
  ...volunteerWithCoordinator,
  assignedCoordinators: [coordinator, secondCoordinator],
} as FosterVolunteer;

const originalSenderEmail = process.env.AWS_SES_SENDER_EMAIL;

describe('MatchesService', () => {
  let service: MatchesService;
  let matchRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    manager: {
      transaction: jest.Mock;
    };
  };
  let transactionRepo: {
    findOneBy: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
  };
  let transactionManager: {
    getRepository: jest.Mock;
  };
  let volunteersService: { findActiveOrFail: jest.Mock };
  let emailsService: { sendEmail: jest.Mock };

  const matches = [
    {
      matchId: 1,
      volunteerId: 7,
      chameleonAnimalId: 42,
      status: MatchStatus.PENDING,
      deniedReason: null,
    },
    {
      matchId: 2,
      volunteerId: 7,
      chameleonAnimalId: 43,
      status: MatchStatus.DENIED,
      deniedReason: 'Resident dog is not cat-friendly',
    },
  ] as Match[];

  const mockMatch = {
    matchId: 1,
    chameleonAnimalId: 42,
    status: MatchStatus.PENDING,
    deniedReason: null,
  } as Match;

  beforeEach(async () => {
    process.env.AWS_SES_SENDER_EMAIL = 'test-sender@example.com';

    transactionRepo = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    transactionManager = {
      getRepository: jest.fn().mockReturnValue(transactionRepo),
    };

    matchRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      manager: {
        transaction: jest
          .fn()
          .mockImplementation(async (callback) => callback(transactionManager)),
      },
    };

    volunteersService = { findActiveOrFail: jest.fn() };
    emailsService = { sendEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getRepositoryToken(Match), useValue: matchRepo },
        { provide: VolunteersService, useValue: volunteersService },
        { provide: EmailsService, useValue: emailsService },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalSenderEmail === undefined) {
      delete process.env.AWS_SES_SENDER_EMAIL;
    } else {
      process.env.AWS_SES_SENDER_EMAIL = originalSenderEmail;
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const originalSenderEmail = process.env.AWS_SES_SENDER_EMAIL;

    beforeEach(() => {
      process.env.AWS_SES_SENDER_EMAIL = 'sender@example.com';
    });

    afterEach(() => {
      if (originalSenderEmail === undefined) {
        delete process.env.AWS_SES_SENDER_EMAIL;
      } else {
        process.env.AWS_SES_SENDER_EMAIL = originalSenderEmail;
      }
    });

    it('creates the match with a PENDING status', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue(
        volunteerWithCoordinator,
      );
      emailsService.sendEmail.mockResolvedValue(undefined);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(volunteersService.findActiveOrFail).toHaveBeenCalledWith(1);
      expect(matchRepo.create).toHaveBeenCalledWith({
        volunteerId: 1,
        chameleonAnimalId: 42,
        status: MatchStatus.PENDING,
        deniedReason: null,
      });
      expect(match.status).toEqual(MatchStatus.PENDING);
    });

    it("emails the sender address with the volunteer's assigned coordinator cc'd", async () => {
      volunteersService.findActiveOrFail.mockResolvedValue(
        volunteerWithCoordinator,
      );
      emailsService.sendEmail.mockResolvedValue(undefined);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'sender@example.com',
          ccEmails: [coordinator.email],
          subject: 'New foster match created',
        }),
      );
    });

    it('ccs every assigned coordinator on one email', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue(
        volunteerWithCoordinators,
      );
      emailsService.sendEmail.mockResolvedValue(undefined);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'sender@example.com',
          ccEmails: [coordinator.email, secondCoordinator.email],
        }),
      );
    });

    it('names the volunteer and the animal in the email body', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue(
        volunteerWithCoordinator,
      );
      emailsService.sendEmail.mockResolvedValue(undefined);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      const { bodyHtml } = emailsService.sendEmail.mock
        .calls[0][0] as SendEmailDTO;

      expect(bodyHtml).toContain('Ada Lovelace');
      expect(bodyHtml).toContain('volunteer 1');
      expect(bodyHtml).toContain('42');
    });

    it('does not email inactive assigned coordinators', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue({
        ...volunteerWithCoordinator,
        assignedCoordinators: [inactiveCoordinator, coordinator],
      } as FosterVolunteer);
      emailsService.sendEmail.mockResolvedValue(undefined);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ ccEmails: [coordinator.email] }),
      );
    });

    it.each([
      ['every assigned coordinator is inactive', [inactiveCoordinator]],
      ['the volunteer has no assigned coordinators', []],
    ])(
      'creates the match, warns, and sends nothing when %s',
      async (_, assignedCoordinators) => {
        volunteersService.findActiveOrFail.mockResolvedValue({
          ...volunteerWithCoordinator,
          assignedCoordinators,
        } as FosterVolunteer);
        matchRepo.create.mockImplementation((attrs) => attrs);
        matchRepo.save.mockImplementation((match) =>
          Promise.resolve({ matchId: 10, ...match }),
        );
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

        const match = await service.create({
          volunteerId: 1,
          chameleonAnimalId: 42,
        });

        expect(match.matchId).toEqual(10);
        expect(match.status).toEqual(MatchStatus.PENDING);
        expect(emailsService.sendEmail).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
      },
    );

    it('creates the match even when the email fails to send', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue(
        volunteerWithCoordinator,
      );
      emailsService.sendEmail.mockRejectedValue(new Error('SES is down'));
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );

      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(match.matchId).toEqual(10);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        'Failed to send match creation email for match 10.',
        expect.any(String),
      );
    });

    it('creates the match and logs an error when assignedCoordinators is not loaded', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue({
        ...volunteerWithCoordinator,
        assignedCoordinators: undefined,
      } as unknown as FosterVolunteer);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(match.matchId).toEqual(10);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        'Failed to send match creation email for match 10.',
        expect.any(String),
      );
    });

    it('throws when the volunteer does not exist', async () => {
      volunteersService.findActiveOrFail.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(
        service.create({ volunteerId: 999, chameleonAnimalId: 42 }),
      ).rejects.toThrow(NotFoundException);

      expect(matchRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws when the volunteer is not active', async () => {
      volunteersService.findActiveOrFail.mockRejectedValue(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );

      await expect(
        service.create({ volunteerId: 1, chameleonAnimalId: 42 }),
      ).rejects.toThrow(BadRequestException);

      expect(matchRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('withdraw', () => {
    it('sets the status to WITHDRAWN and keeps the record', async () => {
      matchRepo.findOneBy.mockResolvedValue({
        matchId: 10,
        status: MatchStatus.PENDING,
      });

      matchRepo.save.mockImplementation((match) => Promise.resolve(match));

      const match = await service.withdraw(10);

      expect(matchRepo.findOneBy).toHaveBeenCalledWith({ matchId: 10 });
      expect(matchRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: 10,
          status: MatchStatus.WITHDRAWN,
        }),
      );
      expect(match.status).toEqual(MatchStatus.WITHDRAWN);
    });

    it('throws when the match does not exist', async () => {
      matchRepo.findOneBy.mockResolvedValue(null);

      await expect(service.withdraw(999)).rejects.toThrow(NotFoundException);
      expect(matchRepo.findOneBy).toHaveBeenCalledWith({ matchId: 999 });
      expect(matchRepo.save).not.toHaveBeenCalled();
    });

    it('throws when the match is not pending', async () => {
      matchRepo.findOneBy.mockResolvedValue({
        matchId: 10,
        status: MatchStatus.ACTIVE,
      });

      await expect(service.withdraw(10)).rejects.toThrow(BadRequestException);
      expect(matchRepo.findOneBy).toHaveBeenCalledWith({ matchId: 10 });
      expect(matchRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findByVolunteerId', () => {
    it('returns the matches for the volunteer', async () => {
      matchRepo.find.mockResolvedValue(matches);

      const result = await service.findByVolunteerId(7);

      expect(result).toBe(matches);
      expect(matchRepo.find).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
      });
    });

    it('returns an empty array when the volunteer has no matches', async () => {
      matchRepo.find.mockResolvedValue([]);

      await expect(service.findByVolunteerId(7)).resolves.toEqual([]);
      expect(matchRepo.find).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
      });
    });
  });

  describe('approveMatch', () => {
    beforeEach(() => {
      transactionRepo.save.mockImplementation((match) =>
        Promise.resolve(match),
      );
      transactionRepo.find.mockResolvedValue([]);
      emailsService.sendEmail.mockResolvedValue(undefined);
    });

    it('should approve a pending match and set its status to Active', async () => {
      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });

      const result = await service.approveMatch(1);

      expect(result.status).toBe(MatchStatus.ACTIVE);
      expect(matchRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(transactionManager.getRepository).toHaveBeenCalledWith(Match);
      expect(transactionRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(transactionRepo.save).toHaveBeenCalledWith({
        ...mockMatch,
        status: MatchStatus.ACTIVE,
      });
    });

    it('should cancel other pending matches for the same animal', async () => {
      const otherMatches = [
        {
          matchId: 2,
          volunteerId: 2,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer2@gmail.com' },
        },
        {
          matchId: 3,
          volunteerId: 3,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer3@gmail.com' },
        },
      ] as Match[];

      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue(otherMatches);

      const result = await service.approveMatch(1);

      expect(result.status).toBe(MatchStatus.ACTIVE);
      expect(otherMatches[0].status).toBe(MatchStatus.CANCELED);
      expect(otherMatches[1].status).toBe(MatchStatus.CANCELED);
      expect(transactionRepo.save).toHaveBeenCalledTimes(2);
      expect(transactionRepo.save).toHaveBeenCalledWith(otherMatches);
      expect(transactionRepo.find).toHaveBeenCalledWith({
        where: {
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          matchId: expect.objectContaining({
            _type: 'not',
            _value: 1,
          }),
        },
        relations: ['volunteer'],
      });
    });

    it('should send one email with other applicants in BCC', async () => {
      const otherMatches = [
        {
          matchId: 2,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer2@gmail.com' },
        },
        {
          matchId: 3,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer3@gmail.com' },
        },
      ] as Match[];

      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue(otherMatches);

      await service.approveMatch(1);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith({
        toEmail: process.env.AWS_SES_SENDER_EMAIL,
        bccEmails: ['volunteer2@gmail.com', 'volunteer3@gmail.com'],
        subject: 'Foster Application Update',
        bodyHtml: expect.stringContaining('another'),
      });
    });

    it('should not send an email when there are no other applicants', async () => {
      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue([]);

      const result = await service.approveMatch(1);

      expect(result.status).toBe(MatchStatus.ACTIVE);
      expect(transactionRepo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not include duplicate applicant emails in BCC', async () => {
      const otherMatches = [
        {
          matchId: 2,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer2@gmail.com' },
        },
        {
          matchId: 3,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer2@gmail.com' },
        },
      ] as Match[];

      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue(otherMatches);

      await service.approveMatch(1);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          bccEmails: ['volunteer2@gmail.com'],
        }),
      );
    });

    it('should approve and cancel matches even when email sending fails', async () => {
      const otherMatches = [
        {
          matchId: 2,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer2@gmail.com' },
        },
      ] as Match[];

      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue(otherMatches);
      emailsService.sendEmail.mockRejectedValue(new Error('SES is down'));

      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const result = await service.approveMatch(1);

      expect(result.status).toBe(MatchStatus.ACTIVE);
      expect(otherMatches[0].status).toBe(MatchStatus.CANCELED);
      expect(matchRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(transactionRepo.save).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to send match cancellation email batch',
        ),
        expect.any(Error),
      );
    });

    it('should roll back approval if saving cancellations fails', async () => {
      const persistedMatches = [
        { ...mockMatch },
        {
          matchId: 2,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer2@gmail.com' },
        },
      ] as Match[];

      const originalMatches = persistedMatches.map((match) => ({ ...match }));

      transactionRepo.findOneBy.mockResolvedValue({ ...persistedMatches[0] });
      transactionRepo.find.mockResolvedValue([{ ...persistedMatches[1] }]);

      transactionRepo.save.mockImplementation(async (value) => {
        if (Array.isArray(value)) {
          throw new Error('Cancellation save failed');
        }

        persistedMatches[0] = { ...value };
        return value;
      });

      matchRepo.manager.transaction.mockImplementation(async (callback) => {
        try {
          return await callback(transactionManager);
        } catch (error) {
          persistedMatches.splice(
            0,
            persistedMatches.length,
            ...originalMatches,
          );
          throw error;
        }
      });

      await expect(service.approveMatch(1)).rejects.toThrow(
        'Cancellation save failed',
      );

      expect(transactionRepo.save).toHaveBeenCalledTimes(2);
      expect(persistedMatches[0].status).toBe(MatchStatus.PENDING);
      expect(persistedMatches[1].status).toBe(MatchStatus.PENDING);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('should send cancellation emails in batches of 50', async () => {
      const otherMatches = Array.from({ length: 105 }, (_, index) => ({
        matchId: index + 2,
        chameleonAnimalId: 42,
        status: MatchStatus.PENDING,
        volunteer: { email: `volunteer${index + 2}@gmail.com` },
      })) as Match[];

      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue(otherMatches);

      await service.approveMatch(1);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);

      const calls = emailsService.sendEmail.mock.calls;

      expect(calls[0][0].bccEmails).toHaveLength(50);
      expect(calls[1][0].bccEmails).toHaveLength(50);
      expect(calls[2][0].bccEmails).toHaveLength(5);

      expect(calls[0][0].toEmail).toBe(process.env.AWS_SES_SENDER_EMAIL);

      const allRecipients = calls.flatMap((call) => call[0].bccEmails);

      expect(allRecipients).toHaveLength(105);
      expect(new Set(allRecipients).size).toBe(105);
      expect(transactionRepo.save).toHaveBeenCalledTimes(2);
      expect(
        otherMatches.every((match) => match.status === MatchStatus.CANCELED),
      ).toBe(true);
    });

    it('should continue sending batches when one batch fails', async () => {
      const otherMatches = Array.from({ length: 105 }, (_, index) => ({
        matchId: index + 2,
        chameleonAnimalId: 42,
        status: MatchStatus.PENDING,
        volunteer: { email: `volunteer${index + 2}@gmail.com` },
      })) as Match[];

      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue(otherMatches);

      emailsService.sendEmail
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('SES is down'))
        .mockResolvedValueOnce(undefined);

      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const result = await service.approveMatch(1);

      expect(result.status).toBe(MatchStatus.ACTIVE);
      expect(
        otherMatches.every((match) => match.status === MatchStatus.CANCELED),
      ).toBe(true);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);

      const calls = emailsService.sendEmail.mock.calls;

      expect(calls[0][0].bccEmails).toHaveLength(50);
      expect(calls[1][0].bccEmails).toHaveLength(50);
      expect(calls[2][0].bccEmails).toHaveLength(5);

      expect(calls[0][0].bccEmails).toContain('volunteer2@gmail.com');
      expect(calls[1][0].bccEmails).toContain('volunteer52@gmail.com');
      expect(calls[2][0].bccEmails).toContain('volunteer102@gmail.com');

      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('batch 2'),
        expect.any(Error),
      );

      expect(transactionRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should log a missing sender email without affecting approval', async () => {
      delete process.env.AWS_SES_SENDER_EMAIL;

      const otherMatches = [
        {
          matchId: 2,
          chameleonAnimalId: 42,
          status: MatchStatus.PENDING,
          volunteer: { email: 'volunteer2@gmail.com' },
        },
      ] as Match[];

      transactionRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      transactionRepo.find.mockResolvedValue(otherMatches);

      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const result = await service.approveMatch(1);

      expect(result.status).toBe(MatchStatus.ACTIVE);
      expect(otherMatches[0].status).toBe(MatchStatus.CANCELED);
      expect(transactionRepo.save).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('AWS_SES_SENDER_EMAIL is not configured'),
      );
    });

    it('should throw NotFoundException when match does not exist', async () => {
      transactionRepo.findOneBy.mockResolvedValue(null);

      await expect(service.approveMatch(999)).rejects.toThrow(
        new NotFoundException('Match with id 999 not found'),
      );

      expect(transactionRepo.findOneBy).toHaveBeenCalledWith({ matchId: 999 });
      expect(transactionRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when match is not pending', async () => {
      transactionRepo.findOneBy.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.ACTIVE,
      });

      await expect(service.approveMatch(1)).rejects.toThrow(
        new BadRequestException('Match with id 1 is not pending'),
      );

      expect(transactionRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(transactionRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('denyMatch', () => {
    it('should deny a pending match and save the reason', async () => {
      matchRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      matchRepo.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.denyMatch(1, 'Not enough space in home');

      expect(result.status).toBe(MatchStatus.DENIED);
      expect(result.deniedReason).toBe('Not enough space in home');
      expect(matchRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(matchRepo.save).toHaveBeenCalledWith({
        ...mockMatch,
        status: MatchStatus.DENIED,
        deniedReason: 'Not enough space in home',
      });
    });

    it('should throw NotFoundException when match does not exist', async () => {
      matchRepo.findOneBy.mockResolvedValue(null);

      await expect(service.denyMatch(999, 'Some reason')).rejects.toThrow(
        new NotFoundException('Match with id 999 not found'),
      );

      expect(matchRepo.findOneBy).toHaveBeenCalledWith({ matchId: 999 });
      expect(matchRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when match is not pending', async () => {
      matchRepo.findOneBy.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.DENIED,
      });

      await expect(service.denyMatch(1, 'Some reason')).rejects.toThrow(
        new BadRequestException('Match with id 1 is not pending'),
      );

      expect(matchRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(matchRepo.save).not.toHaveBeenCalled();
    });
  });
});
