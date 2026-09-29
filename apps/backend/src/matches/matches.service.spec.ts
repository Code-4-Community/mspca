import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger, NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { EmailsService } from '../aws/ses/email.service';

const coordinator = {
  coordinatorId: 7,
  email: 'coordinator@example.com',
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
  };
  let volunteerRepo: { findOne: jest.Mock };
  let emailsService: { sendEmail: jest.Mock };

  beforeEach(async () => {
    matchRepo = {
      create: jest.fn((attrs) => attrs),
      save: jest.fn((match) => Promise.resolve({ matchId: 10, ...match })),
      findOneBy: jest.fn(),
    };
    volunteerRepo = { findOne: jest.fn() };
    emailsService = { sendEmail: jest.fn().mockResolvedValue(undefined) };

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

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
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

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'coordinator@example.com' }),
      );
    });

    it('still creates the match when the volunteer has no coordinator', async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithoutCoordinator);
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(match.status).toEqual(MatchStatus.PENDING);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('returns the match when the email fails to send', async () => {
      volunteerRepo.findOne.mockResolvedValue(volunteerWithCoordinator);
      emailsService.sendEmail.mockRejectedValue(new Error('SES is down'));
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

      const match = await service.withdraw(10);

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
  });
});
