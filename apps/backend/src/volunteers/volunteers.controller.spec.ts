import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dtos/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { UpdateFosterTypePreferencesDto } from './dtos/update-foster-type-preferences.dto';
import { Match } from '../matches/matches.entity';
import { Homebase } from '../types';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';
import { validate } from 'class-validator';

describe('VolunteersController', () => {
  let controller: VolunteersController;

  let mockVolunteersService: {
    create: jest.Mock;
    confirm: jest.Mock;
    findByIdOrFail: jest.Mock;
    findActiveOrFail: jest.Mock;
    deactivate: jest.Mock;
    reactivate: jest.Mock;
    updateVolunteerById: jest.Mock;
    updateFosterTypePreferences: jest.Mock;
    approve: jest.Mock;
    deny: jest.Mock;
    getAllVolunteers: jest.Mock;
    updateAnimalPreferences: jest.Mock;
  };

  let mockMatchesService: {
    findByVolunteerId: jest.Mock;
  };

  const volunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    status: VolunteerStatus.ACTIVE,
    fosterTypePreferences: [FosterType.DOG],
  } as FosterVolunteer;

  beforeEach(async () => {
    mockVolunteersService = {
      create: jest.fn(),
      confirm: jest.fn(),
      findByIdOrFail: jest.fn(),
      findActiveOrFail: jest.fn(),
      deactivate: jest.fn(),
      reactivate: jest.fn(),
      updateVolunteerById: jest.fn(),
      updateFosterTypePreferences: jest.fn(),
      approve: jest.fn(),
      deny: jest.fn(),
      getAllVolunteers: jest.fn(),
      updateAnimalPreferences: jest.fn(),
    };

    mockMatchesService = {
      findByVolunteerId: jest.fn(),
    };

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
      const createdVolunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;

      mockVolunteersService.create.mockResolvedValue(createdVolunteer);

      const result = await controller.create(dto);

      expect(mockVolunteersService.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(createdVolunteer);
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
    it('returns the matches for a volunteer', async () => {
      const matches = [{ matchId: 1 }] as Match[];

      mockVolunteersService.findByIdOrFail.mockResolvedValue(volunteer);
      mockMatchesService.findByVolunteerId.mockResolvedValue(matches);

      const result = await controller.getVolunteerMatches(1);

      expect(result).toEqual(matches);
      expect(mockVolunteersService.findByIdOrFail).toHaveBeenCalledWith(1);
      expect(mockMatchesService.findByVolunteerId).toHaveBeenCalledWith(1);
    });

    it('rejects an invalid volunteer ID', async () => {
      await expect(controller.getVolunteerMatches(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockMatchesService.findByVolunteerId).not.toHaveBeenCalled();
    });

    it('propagates an error when the volunteer is not found', async () => {
      mockVolunteersService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('Volunteer not found'),
      );

      await expect(controller.getVolunteerMatches(1)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockMatchesService.findByVolunteerId).not.toHaveBeenCalled();
    });
  });

  describe('getVolunteerById', () => {
    it('returns a volunteer by ID', async () => {
      mockVolunteersService.findByIdOrFail.mockResolvedValue(volunteer);

      const result = await controller.getVolunteerById(1);

      expect(result).toEqual(volunteer);
      expect(mockVolunteersService.findByIdOrFail).toHaveBeenCalledWith(1);
    });

    it('rejects an invalid ID', async () => {
      await expect(controller.getVolunteerById(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockVolunteersService.findByIdOrFail).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('deactivates an active volunteer', async () => {
      const updated = {
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;

      mockVolunteersService.deactivate.mockResolvedValue(updated);

      const result = await controller.deactivate(1);

      expect(result).toEqual(updated);
      expect(mockVolunteersService.deactivate).toHaveBeenCalledWith(1);
    });

    it('rejects an invalid ID', async () => {
      await expect(controller.deactivate(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockVolunteersService.deactivate).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('reactivates an inactive volunteer', async () => {
      const updated = {
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;

      mockVolunteersService.reactivate.mockResolvedValue(updated);

      const result = await controller.reactivate(1);

      expect(result).toEqual(updated);
      expect(mockVolunteersService.reactivate).toHaveBeenCalledWith(1);
    });

    it('rejects an invalid ID', async () => {
      await expect(controller.reactivate(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockVolunteersService.reactivate).not.toHaveBeenCalled();
    });
  });

  describe('updateVolunteerById', () => {
    it('updates and returns the volunteer', async () => {
      const dto = { notes: 'Updated notes' } as UpdateVolunteerDto;
      const updated = { ...volunteer, ...dto } as FosterVolunteer;

      mockVolunteersService.updateVolunteerById.mockResolvedValue(updated);

      const result = await controller.updateVolunteerById(1, dto);

      expect(result).toEqual(updated);
      expect(mockVolunteersService.updateVolunteerById).toHaveBeenCalledWith(
        1,
        dto,
      );
    });

    it('rejects an empty update', async () => {
      await expect(controller.updateVolunteerById(1, {})).rejects.toThrow(
        BadRequestException,
      );

      expect(mockVolunteersService.updateVolunteerById).not.toHaveBeenCalled();
    });

    it('rejects an invalid ID', async () => {
      await expect(
        controller.updateVolunteerById(0, { notes: 'Updated' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockVolunteersService.updateVolunteerById).not.toHaveBeenCalled();
    });
  });

  describe('updateFosterTypePreferences', () => {
    it('returns the updated preferences from the service', async () => {
      const dto: UpdateFosterTypePreferencesDto = {
        added: [FosterType.CAT],
        removed: [FosterType.DOG],
      };

      const updatedPreferences = [FosterType.CAT];

      mockVolunteersService.updateFosterTypePreferences.mockResolvedValue(
        updatedPreferences,
      );

      const result = await controller.updateFosterTypePreferences(1, dto);

      expect(result).toEqual(updatedPreferences);
      expect(
        mockVolunteersService.updateFosterTypePreferences,
      ).toHaveBeenCalledWith(1, dto);
    });

    it.each([{}, { added: [], removed: [] }])(
      'rejects an empty preference update: %j',
      async (body) => {
        const dto = Object.assign(new UpdateFosterTypePreferencesDto(), body);
        const errors = await validate(dto);

        expect(
          errors.some(
            (error) =>
              error.constraints?.atLeastOneFosterTypePreference !== undefined,
          ),
        ).toBe(true);
      },
    );

    it('rejects an invalid volunteer ID without calling the service', async () => {
      await expect(
        controller.updateFosterTypePreferences(0, {
          added: [FosterType.CAT],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(
        mockVolunteersService.updateFosterTypePreferences,
      ).not.toHaveBeenCalled();
    });

    it('propagates errors thrown by the service', async () => {
      const dto = { added: [FosterType.CAT] };

      mockVolunteersService.updateFosterTypePreferences.mockRejectedValue(
        new NotFoundException('Volunteer with ID 999 not found'),
      );

      await expect(
        controller.updateFosterTypePreferences(999, dto),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockVolunteersService.updateFosterTypePreferences,
      ).toHaveBeenCalledWith(999, dto);
    });
  });

  describe('approve', () => {
    it('approves a pending volunteer', async () => {
      const approved = {
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;

      mockVolunteersService.approve.mockResolvedValue(approved);

      const result = await controller.approve(1);

      expect(result).toEqual(approved);
      expect(mockVolunteersService.approve).toHaveBeenCalledWith(1);
    });

    it('rejects an invalid ID', async () => {
      await expect(controller.approve(0)).rejects.toThrow(BadRequestException);

      expect(mockVolunteersService.approve).not.toHaveBeenCalled();
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
    it('returns all volunteers', async () => {
      const volunteers = [volunteer];

      mockVolunteersService.getAllVolunteers.mockResolvedValue(volunteers);

      const result = await controller.getAllVolunteers();

      expect(result).toEqual(volunteers);
      expect(mockVolunteersService.getAllVolunteers).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when no volunteers exist', async () => {
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
