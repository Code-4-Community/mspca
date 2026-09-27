import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { MatchStatus } from '../matches/matches.types';

describe('VolunteersController', () => {
  let controller: VolunteersController;
  let volunteersService: { existsById: jest.Mock };
  let matchesService: { findByVolunteerId: jest.Mock };

  beforeEach(async () => {
    volunteersService = { existsById: jest.fn() };
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
      volunteersService.existsById.mockResolvedValue(true);
      matchesService.findByVolunteerId.mockResolvedValue(matches);

      const result = await controller.getVolunteerMatches('7');

      expect(result).toBe(matches);
      expect(volunteersService.existsById).toHaveBeenCalledWith(7);
      expect(matchesService.findByVolunteerId).toHaveBeenCalledWith(7);
    });

    it('returns an empty array when the volunteer exists but has no matches', async () => {
      volunteersService.existsById.mockResolvedValue(true);
      matchesService.findByVolunteerId.mockResolvedValue([]);

      await expect(controller.getVolunteerMatches('7')).resolves.toEqual([]);
    });

    it('throws NotFoundException when the volunteer does not exist', async () => {
      volunteersService.existsById.mockResolvedValue(false);

      await expect(controller.getVolunteerMatches('999')).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(matchesService.findByVolunteerId).not.toHaveBeenCalled();
    });

    it.each(['abc', '0', '-3', ''])(
      'throws BadRequestException for invalid id %p',
      async (invalidId) => {
        await expect(controller.getVolunteerMatches(invalidId)).rejects.toThrow(
          BadRequestException,
        );
        expect(volunteersService.existsById).not.toHaveBeenCalled();
        expect(matchesService.findByVolunteerId).not.toHaveBeenCalled();
      },
    );
  });
});
