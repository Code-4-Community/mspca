import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { MatchStatus } from '../matches/matches.types';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';

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
    deactivate: jest.Mock;
    reactivate: jest.Mock;
    updateVolunteerById: jest.Mock;
    approve: jest.Mock;
    getAllVolunteers: jest.Mock;
    updateAnimalPreferences: jest.Mock;
  };
  let mockMatchesService: { findByVolunteerId: jest.Mock };

  const mockVolunteers = [
    { volunteerId: 1, firstName: 'Jane', lastName: 'Doe' },
    { volunteerId: 2, firstName: 'John', lastName: 'Smith' },
  ] as FosterVolunteer[];

  beforeEach(async () => {
    mockVolunteersService = {
      findByIdOrFail: jest.fn(),
      deactivate: jest.fn(),
      reactivate: jest.fn(),
      updateVolunteerById: jest.fn(),
      approve: jest.fn(),
      getAllVolunteers: jest.fn(),
      updateAnimalPreferences: jest.fn(),
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
      mockVolunteersService.findByIdOrFail.mockResolvedValue(mockVolunteer);

      const result = await controller.getVolunteerById(1);

      expect(result).toEqual(mockVolunteer);
      expect(mockVolunteersService.findByIdOrFail).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockVolunteersService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(controller.getVolunteerById(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(controller.getVolunteerById(0)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockVolunteersService.findByIdOrFail).not.toHaveBeenCalled();
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

  describe('deactivate', () => {
    it('should call service.deactivate with the parsed id', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockVolunteersService.deactivate.mockResolvedValue(volunteer);

      const result = await controller.deactivate(1);

      expect(mockVolunteersService.deactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual(volunteer);
    });

    it('propagates errors thrown by the service', async () => {
      mockVolunteersService.deactivate.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(controller.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('reactivate', () => {
    it('should call service.reactivate with the parsed id', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockVolunteersService.reactivate.mockResolvedValue(volunteer);

      const result = await controller.reactivate(1);

      expect(mockVolunteersService.reactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual(volunteer);
    });

    it('propagates errors thrown by the service', async () => {
      mockVolunteersService.reactivate.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(controller.reactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('approve', () => {
    it('should call service.approve with the parsed id', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockVolunteersService.approve.mockResolvedValue(volunteer);

      const result = await controller.approve(1);

      expect(mockVolunteersService.approve).toHaveBeenCalledWith(1);
      expect(result).toEqual(volunteer);
    });

    it('throws BadRequestException for an invalid id without calling the service', async () => {
      await expect(controller.approve(0)).rejects.toThrow(
        new BadRequestException('Invalid Volunteer ID'),
      );
      expect(mockVolunteersService.approve).not.toHaveBeenCalled();
    });

    it('propagates errors thrown by the service', async () => {
      mockVolunteersService.approve.mockRejectedValue(
        new ConflictException('Only pending Volunteers can be approved'),
      );

      await expect(controller.approve(1)).rejects.toThrow(
        new ConflictException('Only pending Volunteers can be approved'),
      );
    });
  });

  describe('getAllVolunteers', () => {
    it('should return all volunteers', async () => {
      mockVolunteersService.getAllVolunteers.mockResolvedValue(mockVolunteers);

      const result = await controller.getAllVolunteers();

      expect(result).toEqual(mockVolunteers);
      expect(mockVolunteersService.getAllVolunteers).toHaveBeenCalled();
    });

    it('should return an empty array when there are no volunteers', async () => {
      mockVolunteersService.getAllVolunteers.mockResolvedValue([]);

      const result = await controller.getAllVolunteers();

      expect(result).toEqual([]);
    });
  });

  describe('updateAnimalPreferences', () => {
    it('returns the updated list from the service', async () => {
      const dto = { added: [55], removed: [107] };
      mockVolunteersService.updateAnimalPreferences.mockResolvedValue([42, 55]);

      const result = await controller.updateAnimalPreferences(1, dto);

      expect(result).toEqual([42, 55]);
      expect(
        mockVolunteersService.updateAnimalPreferences,
      ).toHaveBeenCalledWith(1, dto);
    });

    it('throws BadRequestException when id is invalid', async () => {
      await expect(
        controller.updateAnimalPreferences(0, { added: [42] }),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockVolunteersService.updateAnimalPreferences,
      ).not.toHaveBeenCalled();
    });

    it.each([{}, { added: [] }, { removed: [] }, { added: [], removed: [] }])(
      'throws BadRequestException when neither list has IDs: %j',
      async (body) => {
        await expect(
          controller.updateAnimalPreferences(
            1,
            body as UpdateAnimalPreferencesDto,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'At least one of added or removed must be provided',
          ),
        );
        expect(
          mockVolunteersService.updateAnimalPreferences,
        ).not.toHaveBeenCalled();
      },
    );

    it('propagates NotFoundException thrown by the service', async () => {
      mockVolunteersService.updateAnimalPreferences.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(
        controller.updateAnimalPreferences(999, { added: [42] }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('UpdateAnimalPreferencesDto validation', () => {
    const validateBody = (body: object) =>
      validate(plainToInstance(UpdateAnimalPreferencesDto, body));

    it.each([
      { added: [1, 2] },
      { removed: [3] },
      { added: [1], removed: [2] },
    ])('accepts %j', async (body) => {
      expect(await validateBody(body)).toHaveLength(0);
    });

    it.each([
      { added: [1, 'abc'] },
      { added: [-3] },
      { added: [0] },
      { removed: [1.5] },
      { added: 5 },
    ])('rejects %j', async (body) => {
      expect((await validateBody(body)).length).toBeGreaterThan(0);
    });
  });
});
