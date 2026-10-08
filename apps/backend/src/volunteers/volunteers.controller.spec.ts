import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { MatchStatus } from '../matches/matches.types';
import { FosterVolunteer } from './volunteers.entity';

describe('VolunteersController', () => {
  let controller: VolunteersController;
  let volunteersService: {
    findByIdOrFail: jest.Mock;
    getAllVolunteers: jest.Mock;
  };
  let matchesService: { findByVolunteerId: jest.Mock };

  const mockVolunteers = [
    { volunteerId: 1, firstName: 'Jane', lastName: 'Doe' },
    { volunteerId: 2, firstName: 'John', lastName: 'Smith' },
  ] as FosterVolunteer[];

  beforeEach(async () => {
    volunteersService = {
      findByIdOrFail: jest.fn(),
      getAllVolunteers: jest.fn(),
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

  afterEach(() => {
    jest.clearAllMocks();
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

  describe('getAllVolunteers', () => {
    it('should return all volunteers', async () => {
      volunteersService.getAllVolunteers.mockResolvedValue(mockVolunteers);

      const result = await controller.getAllVolunteers();

      expect(result).toEqual(mockVolunteers);
      expect(volunteersService.getAllVolunteers).toHaveBeenCalled();
    });

    it('should return an empty array when there are no volunteers', async () => {
      volunteersService.getAllVolunteers.mockResolvedValue([]);

      const result = await controller.getAllVolunteers();

      expect(result).toEqual([]);
    });
  });
});
