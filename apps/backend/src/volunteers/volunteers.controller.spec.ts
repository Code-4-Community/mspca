import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { MatchStatus } from '../matches/matches.types';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { UpdateFosterTypePreferencesDto } from './dto/update-foster-type-preferences.dto';

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
    getVolunteerById: jest.Mock;
    updateVolunteerById: jest.Mock;
    updateFosterTypePreferences: jest.Mock;
  };
  let mockMatchesService: { findByVolunteerId: jest.Mock };

  beforeEach(async () => {
    mockVolunteersService = {
      findByIdOrFail: jest.fn(),
      deactivate: jest.fn(),
      reactivate: jest.fn(),
      getVolunteerById: jest.fn(),
      updateVolunteerById: jest.fn(),
      updateFosterTypePreferences: jest.fn(),
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

  describe('updateFosterTypePreferences', () => {
    it('returns the updated list from the service', async () => {
      const dto = { added: [FosterType.CAT], removed: [FosterType.DOG] };
      mockVolunteersService.updateFosterTypePreferences.mockResolvedValue([
        FosterType.CAT,
      ]);

      const result = await controller.updateFosterTypePreferences(1, dto);

      expect(result).toEqual([FosterType.CAT]);
      expect(
        mockVolunteersService.updateFosterTypePreferences,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockVolunteersService.updateFosterTypePreferences,
      ).toHaveBeenCalledWith(1, dto);
    });

    it('returns the list exactly as the service returns it', async () => {
      const list = [FosterType.DOG, FosterType.SMALL_ANIMALS];
      mockVolunteersService.updateFosterTypePreferences.mockResolvedValue(list);

      const result = await controller.updateFosterTypePreferences(5, {
        added: [FosterType.SMALL_ANIMALS],
      });

      expect(result).toBe(list);
    });

    it.each([
      { added: [FosterType.DOG] },
      { removed: [FosterType.DOG] },
      { added: [FosterType.DOG], removed: [] },
      { added: [], removed: [FosterType.DOG] },
      { added: [FosterType.DOG], removed: null },
    ])(
      'calls the service when at least one list has values: %j',
      async (body) => {
        mockVolunteersService.updateFosterTypePreferences.mockResolvedValue([]);

        await controller.updateFosterTypePreferences(
          1,
          body as unknown as UpdateFosterTypePreferencesDto,
        );

        expect(
          mockVolunteersService.updateFosterTypePreferences,
        ).toHaveBeenCalledWith(1, body);
      },
    );

    it.each([0, -1, 1.5, NaN])(
      'throws BadRequestException when id is %p',
      async (id) => {
        await expect(
          controller.updateFosterTypePreferences(id, {
            added: [FosterType.DOG],
          }),
        ).rejects.toThrow(new BadRequestException('Invalid Volunteer ID'));
        expect(
          mockVolunteersService.updateFosterTypePreferences,
        ).not.toHaveBeenCalled();
      },
    );

    it.each([
      {},
      { added: [] },
      { removed: [] },
      { added: [], removed: [] },
      { added: null, removed: null },
      { added: undefined, removed: undefined },
    ])(
      'throws BadRequestException when neither list has values: %j',
      async (body) => {
        await expect(
          controller.updateFosterTypePreferences(
            1,
            body as unknown as UpdateFosterTypePreferencesDto,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'At least one of added or removed must be provided',
          ),
        );
        expect(
          mockVolunteersService.updateFosterTypePreferences,
        ).not.toHaveBeenCalled();
      },
    );

    it('validates the id before checking the body', async () => {
      await expect(
        controller.updateFosterTypePreferences(
          0,
          {} as UpdateFosterTypePreferencesDto,
        ),
      ).rejects.toThrow(new BadRequestException('Invalid Volunteer ID'));
    });

    it('propagates NotFoundException thrown by the service', async () => {
      mockVolunteersService.updateFosterTypePreferences.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(
        controller.updateFosterTypePreferences(999, {
          added: [FosterType.DOG],
        }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });

    it('propagates unexpected errors thrown by the service', async () => {
      mockVolunteersService.updateFosterTypePreferences.mockRejectedValue(
        new Error('db failure'),
      );

      await expect(
        controller.updateFosterTypePreferences(1, { added: [FosterType.DOG] }),
      ).rejects.toThrow('db failure');
    });
  });

  describe('UpdateFosterTypePreferencesDto validation', () => {
    const validateBody = (body: object) =>
      validate(plainToInstance(UpdateFosterTypePreferencesDto, body));

    it.each([
      { added: ['Dog'] },
      { removed: ['Cat'] },
      { added: ['Dog'], removed: ['Cat'] },
      { added: ['Dog', 'Cat', 'Small Animals', 'Baby Bottle Animals'] },
      { added: [], removed: [] },
      { added: null, removed: null },
      {},
    ])('accepts %j', async (body) => {
      expect(await validateBody(body)).toHaveLength(0);
    });

    it.each([
      { added: ['Hamster'] },
      { added: ['Dog', 'Hamster'] },
      { added: ['dog'] },
      { added: ['SMALL_ANIMALS'] },
      { added: [1] },
      { added: [null] },
      { added: 'Dog' },
      { added: { 0: 'Dog' } },
      { removed: ['Rabbit'] },
      { removed: [2] },
      { removed: 'Cat' },
    ])('rejects %j', async (body) => {
      expect((await validateBody(body)).length).toBeGreaterThan(0);
    });

    it('reports an error for each invalid field', async () => {
      const errors = await validateBody({
        added: ['Hamster'],
        removed: ['Rabbit'],
      });

      expect(errors.map((e) => e.property).sort()).toEqual([
        'added',
        'removed',
      ]);
    });
  });
});