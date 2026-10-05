import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmailsService } from '../aws/ses/email.service';
import { SendEmailDTO } from '../aws/ses/sendEmail.dto';

const coordinator = {
  coordinatorId: 7,
  email: 'coordinator@gmail.com',
} as FosterCoordinator;

const volunteerWithCoordinator = {
  volunteerId: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  assignedCoordinator: coordinator,
} as FosterVolunteer;

const volunteerWithoutCoordinator = {
  ...volunteerWithCoordinator,
  assignedCoordinator: null,
} as FosterVolunteer;

describe('MatchesService', () => {
  let service: MatchesService;
  let matchRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
  };
  let volunteerRepo: { findOne: jest.Mock };
  let emailsService: { sendEmail: jest.Mock };

  /** The payload handed to EmailsService on its only send. */
  const sentEmail = (): SendEmailDTO =>
    emailsService.sendEmail.mock.calls[0][0] as SendEmailDTO;

  /** Has the match repo hand back whatever create() asked it to save. */
  const stubSavedMatch = () => {
    matchRepo.create.mockImplementation((attrs) => attrs);
    matchRepo.save.mockImplementation((match) =>
      Promise.resolve({ matchId: 10, ...match }),
    );
  };

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

  beforeEach(async () => {
    matchRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
    };
    volunteerRepo = { findOne: jest.fn() };
    emailsService = { sendEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getRepositoryToken(Match), useValue: matchRepo },
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: volunteerRepo,
        },
        { provide: EmailsService, useValue: emailsService },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates the match with a PENDING status', async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithCoordinator);
      emailsService.sendEmail.mockResolvedValue(undefined);
      stubSavedMatch();

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(volunteerRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(matchRepo.create).toHaveBeenCalledWith({
        volunteerId: 1,
        chameleonAnimalId: 42,
        status: MatchStatus.PENDING,
        deniedReason: null,
      });
      expect(match.status).toEqual(MatchStatus.PENDING);
    });

    it("emails the volunteer's assigned coordinator", async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithCoordinator);
      emailsService.sendEmail.mockResolvedValue(undefined);
      stubSavedMatch();

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: coordinator.email,
          subject: 'New foster match created',
        }),
      );
    });

    it('names the volunteer and the animal in the email body', async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithCoordinator);
      emailsService.sendEmail.mockResolvedValue(undefined);
      stubSavedMatch();

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      const { bodyHtml } = sentEmail();

      expect(bodyHtml).toContain('Ada Lovelace');
      expect(bodyHtml).toContain('volunteer 1');
      expect(bodyHtml).toContain('42');
    });

    // EmailsService is stubbed here, so nothing else would catch a payload that
    // SES would reject - Run real DTO decorators over what the service built.
    it('builds a payload that passes SendEmailDTO validation', async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithCoordinator);
      emailsService.sendEmail.mockResolvedValue(undefined);
      stubSavedMatch();

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      const errors = await validate(plainToInstance(SendEmailDTO, sentEmail()));

      expect(errors).toEqual([]);
    });

    it('still creates the match when the volunteer has no coordinator', async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithoutCoordinator);
      stubSavedMatch();
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(match.status).toEqual(MatchStatus.PENDING);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('creates the match even when the email fails to send', async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithCoordinator);
      emailsService.sendEmail.mockRejectedValue(new Error('SES is down'));
      stubSavedMatch();
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(match.matchId).toEqual(10);
      expect(error).toHaveBeenCalled();
    });

    it('throws when the volunteer does not exist', async () => {
      volunteerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ volunteerId: 999, chameleonAnimalId: 42 }),
      ).rejects.toThrow(NotFoundException);
      expect(matchRepo.save).not.toHaveBeenCalled();
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
      expect(matchRepo.save).not.toHaveBeenCalled();
    });

    it('throws when the match is not pending', async () => {
      matchRepo.findOneBy.mockResolvedValue({
        matchId: 10,
        status: MatchStatus.ACTIVE,
      });

      await expect(service.withdraw(10)).rejects.toThrow(BadRequestException);
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
});
