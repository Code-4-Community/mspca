import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { MatchStatus } from '../matches/matches.types';
import { FosterVolunteer } from './volunteers.entity';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

describe('VolunteersController', () => {
  let controller: VolunteersController;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
  } as FosterVolunteer;

  let mockVolunteersService: {
    findByIdOrFail: jest.Mock;
    getVolunteerById: jest.Mock;
    updateVolunteerById: jest.Mock;
  };
  let mockMatchesService: { findByVolunteerId: jest.Mock };

  beforeEach(async () => {
    mockVolunteersService = {
      findByIdOrFail: jest.fn(),
      getVolunteerById: jest.fn(),
      updateVolunteerById: jest.fn(),
    };
    mockMatchesService = { findByVolunteerId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolunteersController],
      providers: [
        { provide: VolunteersService, useValue: mockVolunteersService },
        { provide: MatchesService, useValue: mockMatchesService },
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
      mockVolunteersService.findByIdOrFail.mockResolvedValue({});
      mockMatchesService.findByVolunteerId.mockResolvedValue(matches);

      const result = await controller.getVolunteerMatches(7);

      expect(result).toBe(matches);
      expect(mockVolunteersService.findByIdOrFail).toHaveBeenCalledWith(7);
      expect(mockMatchesService.findByVolunteerId).toHaveBeenCalledWith(7);
    });

    it('returns an empty array when the volunteer exists but has no matches', async () => {
      mockVolunteersService.findByIdOrFail.mockResolvedValue({});
      mockMatchesService.findByVolunteerId.mockResolvedValue([]);

      await expect(controller.getVolunteerMatches(7)).resolves.toEqual([]);
    });

    it('throws NotFoundException when the volunteer does not exist', async () => {
      mockVolunteersService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(controller.getVolunteerMatches(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockMatchesService.findByVolunteerId).not.toHaveBeenCalled();
    });
  });

  describe('getVolunteerById', () => {
    it('should return a volunteer when found', async () => {
      mockVolunteersService.getVolunteerById.mockResolvedValue(mockVolunteer);

      const result = await controller.getVolunteerById(1);

      expect(result).toEqual(mockVolunteer);
      expect(mockVolunteersService.getVolunteerById).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockVolunteersService.getVolunteerById.mockRejectedValue(
        new NotFoundException('Volunteer with id 999 not found'),
      );

      await expect(controller.getVolunteerById(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(controller.getVolunteerById(0)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockVolunteersService.getVolunteerById).not.toHaveBeenCalled();
    });
  });

  describe('updateVolunteerById', () => {
    it('should update and return the volunteer when found', async () => {
      const dto = { notes: 'updated notes' } as UpdateVolunteerDto;
      const updatedVolunteer = { ...mockVolunteer, ...dto } as FosterVolunteer;
      mockVolunteersService.updateVolunteerById.mockResolvedValue(
        updatedVolunteer,
      );

      const result = await controller.updateVolunteerById(1, dto);

      expect(result).toEqual(updatedVolunteer);
      expect(mockVolunteersService.updateVolunteerById).toHaveBeenCalledWith(
        1,
        dto,
      );
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockVolunteersService.updateVolunteerById.mockRejectedValue(
        new NotFoundException('Volunteer with id 999 not found'),
      );

      await expect(
        controller.updateVolunteerById(999, { notes: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(
        controller.updateVolunteerById(0, { notes: 'x' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockVolunteersService.updateVolunteerById).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      await expect(
        controller.updateVolunteerById(1, {} as UpdateVolunteerDto),
      ).rejects.toThrow(BadRequestException);
      expect(mockVolunteersService.updateVolunteerById).not.toHaveBeenCalled();
    });
  });
});
