import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { MatchStatus } from '../matches/matches.types';
import { FosterVolunteer } from './volunteers.entity';
import {
  FosterTraining,
  FosterType,
  VolunteerStatus,
} from './volunteers.types';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dtos/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { CoordinatorUpdateVolunteerDto } from './dtos/coordinator-update-volunteer.dto';
import { Homebase } from '../types';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';

describe('VolunteersController', () => {
  let controller: VolunteersController;

  const validationPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
  });

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
  } as FosterVolunteer;

  let mockVolunteersService: {
    create: jest.Mock;
    confirm: jest.Mock;
    findByIdOrFail: jest.Mock;
    deactivate: jest.Mock;
    reactivate: jest.Mock;
    updateVolunteerById: jest.Mock;
    approve: jest.Mock;
    deny: jest.Mock;
    getAllVolunteers: jest.Mock;
    updateAnimalPreferences: jest.Mock;
    coordinatorUpdateVolunteerById: jest.Mock;
  };
  let mockMatchesService: { findByVolunteerId: jest.Mock };

  const mockVolunteers = [
    { volunteerId: 1, firstName: 'Jane', lastName: 'Doe' },
    { volunteerId: 2, firstName: 'John', lastName: 'Smith' },
  ] as FosterVolunteer[];

  beforeEach(async () => {
    mockVolunteersService = {
      create: jest.fn(),
      confirm: jest.fn(),
      findByIdOrFail: jest.fn(),
      deactivate: jest.fn(),
      reactivate: jest.fn(),
      updateVolunteerById: jest.fn(),
      approve: jest.fn(),
      deny: jest.fn(),
      getAllVolunteers: jest.fn(),
      updateAnimalPreferences: jest.fn(),
      coordinatorUpdateVolunteerById: jest.fn(),
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

  describe('coordinatorUpdateVolunteerById', () => {
    it('passes the id and dto to the service and returns the volunteer with notes', async () => {
      const dto: CoordinatorUpdateVolunteerDto = {
        coordinatorNotes: 'missed two pickups',
      };
      const updated = {
        ...mockVolunteer,
        coordinatorNotes: 'missed two pickups',
      };
      mockVolunteersService.coordinatorUpdateVolunteerById.mockResolvedValue(
        updated,
      );

      const result = await controller.coordinatorUpdateVolunteerById(1, dto);

      expect(result).toBe(updated);
      expect(result.coordinatorNotes).toBe('missed two pickups');
      expect(
        mockVolunteersService.coordinatorUpdateVolunteerById,
      ).toHaveBeenCalledWith(1, dto);
    });

    it('accepts volunteer-editable fields alongside the notes', async () => {
      const dto: CoordinatorUpdateVolunteerDto = {
        city: 'Boston',
        coordinatorNotes: 'flag',
      };
      mockVolunteersService.coordinatorUpdateVolunteerById.mockResolvedValue({
        ...mockVolunteer,
        ...dto,
      });

      await controller.coordinatorUpdateVolunteerById(1, dto);

      expect(
        mockVolunteersService.coordinatorUpdateVolunteerById,
      ).toHaveBeenCalledWith(1, dto);
    });

    it('throws BadRequestException when no fields are provided', async () => {
      await expect(
        controller.coordinatorUpdateVolunteerById(1, {}),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockVolunteersService.coordinatorUpdateVolunteerById,
      ).not.toHaveBeenCalled();
    });

    it('rejects an invalid volunteer id without calling the service', async () => {
      await expect(
        controller.coordinatorUpdateVolunteerById(-1, {
          coordinatorNotes: 'x',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockVolunteersService.coordinatorUpdateVolunteerById,
      ).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException from the service', async () => {
      const error = new NotFoundException('Volunteer with ID 999 not found');
      mockVolunteersService.coordinatorUpdateVolunteerById.mockRejectedValue(
        error,
      );

      await expect(
        controller.coordinatorUpdateVolunteerById(999, {
          coordinatorNotes: 'x',
        }),
      ).rejects.toBe(error);
    });

    it.each([[['Bird']], [['Dog', 'Dog']], ['Dog'], [[1]], [null]])(
      'rejects completedTrainings %j',
      async (completedTrainings) => {
        await expect(
          validationPipe.transform(
            { completedTrainings },
            { type: 'body', metatype: CoordinatorUpdateVolunteerDto },
          ),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it.each([[[]], [[FosterTraining.CAT]]])(
      'accepts completedTrainings %j',
      async (completedTrainings) => {
        const result = await validationPipe.transform(
          { completedTrainings },
          { type: 'body', metatype: CoordinatorUpdateVolunteerDto },
        );

        expect(result.completedTrainings).toEqual(completedTrainings);
      },
    );
  });
  describe('create', () => {
    const dto = {
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '617-555-0100',
      email: 'jane@example.com',
      address: '350 S Huntington Ave',
      city: 'Boston',
      zipcode: '02130',
      homebase: Homebase.BOSTON,
      residentAnimals: 'One cat',
      fosterType: FosterType.CAT,
      password: 'Str0ng!Password',
    } as CreateVolunteerDto;

    it('creates the volunteer through the service and returns it', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      mockVolunteersService.create.mockResolvedValue(volunteer);

      const result = await controller.create(dto);

      expect(mockVolunteersService.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(volunteer);
    });

    it.each([
      new ConflictException('A volunteer with this email already exists'),
      new BadRequestException('Password does not meet the requirements'),
    ])('propagates %s thrown by the service', async (error) => {
      mockVolunteersService.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toThrow(error);
      expect(mockVolunteersService.create).toHaveBeenCalledTimes(1);
      expect(mockVolunteersService.create).toHaveBeenCalledWith(dto);
    });

    it.each([[['Bird']], [['Dog', 'Dog']], ['Dog'], [[1]], [null]])(
      'rejects completedTrainings %j',
      async (completedTrainings) => {
        await expect(
          validationPipe.transform(
            { ...dto, completedTrainings },
            { type: 'body', metatype: CreateVolunteerDto },
          ),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it.each([
      [[]],
      [[FosterTraining.DOG]],
      [[FosterTraining.DOG, FosterTraining.CAT]],
    ])('accepts completedTrainings %j', async (completedTrainings) => {
      const result = await validationPipe.transform(
        { ...dto, completedTrainings },
        { type: 'body', metatype: CreateVolunteerDto },
      );

      expect(result.completedTrainings).toEqual(completedTrainings);
    });

    it('accepts a body without completedTrainings', async () => {
      const result = await validationPipe.transform(dto, {
        type: 'body',
        metatype: CreateVolunteerDto,
      });

      expect(result).not.toHaveProperty('completedTrainings');
    });
  });

  describe('confirm', () => {
    const dto = {
      email: 'jane@example.com',
      code: '123456',
    } as ConfirmVolunteerDto;

    it('confirms the volunteer through the service', async () => {
      mockVolunteersService.confirm.mockResolvedValue(undefined);

      await expect(controller.confirm(dto)).resolves.toBeUndefined();

      expect(mockVolunteersService.confirm).toHaveBeenCalledTimes(1);
      expect(mockVolunteersService.confirm).toHaveBeenCalledWith(dto);
    });

    it('propagates errors thrown by the service', async () => {
      mockVolunteersService.confirm.mockRejectedValue(
        new BadRequestException('Invalid verification code'),
      );

      await expect(controller.confirm(dto)).rejects.toThrow(
        new BadRequestException('Invalid verification code'),
      );
      expect(mockVolunteersService.confirm).toHaveBeenCalledTimes(1);
      expect(mockVolunteersService.confirm).toHaveBeenCalledWith(dto);
    });
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

  describe('deny', () => {
    it('calls service.deny with the parsed id and returns nothing', async () => {
      mockVolunteersService.deny.mockResolvedValue(undefined);

      const result = await controller.deny(1);

      expect(mockVolunteersService.deny).toHaveBeenCalledTimes(1);
      expect(mockVolunteersService.deny).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });

    it('propagates errors thrown by the service', async () => {
      const error = new InternalServerErrorException(
        'Failed to delete user: boom',
      );
      mockVolunteersService.deny.mockRejectedValue(error);

      await expect(controller.deny(1)).rejects.toBe(error);
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

    it('propagates errors thrown by the service', async () => {
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
});
