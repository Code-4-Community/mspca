import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { MatchStatus } from '../matches/matches.types';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';

describe('VolunteersController', () => {
  let controller: VolunteersController;
  let volunteersService: {
    findByIdOrFail: jest.Mock;
    deactivate: jest.Mock;
    activate: jest.Mock;
  };
  let matchesService: { findByVolunteerId: jest.Mock };

  beforeEach(async () => {
    volunteersService = {
      findByIdOrFail: jest.fn(),
      deactivate: jest.fn(),
      activate: jest.fn(),
    };
    matchesService = { findByVolunteerId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolunteersController],
      providers: [
        {
          provide: VolunteersService,
          useValue: volunteersService,
        },
        {
          provide: MatchesService,
          useValue: matchesService,
        },
      ],
    }).compile();

    controller = module.get<VolunteersController>(VolunteersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVolunteerMatches', () => {
    it("returns the volunteer's matches", async () => {
      const matches = [
        {
          matchId: 1,
          volunteerId: 7,
          chameleonAnimalId: 42,
          status: MatchStatus.DENIED,
          deniedReason: 'Schedule conflict',
        },
      ] as Match[];
      volunteersService.findByIdOrFail.mockResolvedValue({});
      matchesService.findByVolunteerId.mockResolvedValue(matches);

      const result = await controller.getVolunteerMatches(7);

      expect(result).toBe(matches);
      expect(volunteersService.findByIdOrFail).toHaveBeenCalledWith(7);
      expect(matchesService.findByVolunteerId).toHaveBeenCalledWith(7);
    });

    it('returns an empty array when the volunteer exists but has no matches', async () => {
      volunteersService.findByIdOrFail.mockResolvedValue({});
      matchesService.findByVolunteerId.mockResolvedValue([]);

      await expect(controller.getVolunteerMatches(7)).resolves.toEqual([]);
    });

    it('throws NotFoundException when the volunteer does not exist', async () => {
      volunteersService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(controller.getVolunteerMatches(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(matchesService.findByVolunteerId).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should call service.deactivate with the parsed id', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      volunteersService.deactivate.mockResolvedValue(volunteer);

      const result = await controller.deactivate(1);

      expect(volunteersService.deactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual(volunteer);
    });

    it('propagates NotFoundException thrown by the service', async () => {
      volunteersService.deactivate.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(controller.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('activate', () => {
    it('should call service.activate with the parsed id', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      volunteersService.activate.mockResolvedValue(volunteer);

      const result = await controller.activate(1);

      expect(volunteersService.activate).toHaveBeenCalledWith(1);
      expect(result).toEqual(volunteer);
    });

    it('propagates NotFoundException thrown by the service', async () => {
      volunteersService.activate.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(controller.activate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });
});
