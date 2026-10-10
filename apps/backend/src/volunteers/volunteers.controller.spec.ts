import { Test, TestingModule } from '@nestjs/testing';
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
import { FosterType, VolunteerStatus } from './volunteers.types';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dto/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { Homebase } from '../types';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateHomebaseDto } from './dto/update-homebase.dto';

describe('VolunteersController', () => {
  let controller: VolunteersController;

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
    getAllVolunteers: jest.Mock;
    changeHomebase: jest.Mock;
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
      getAllVolunteers: jest.fn(),
      changeHomebase: jest.fn(),
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

    it('propagates errors thrown by the service', async () => {
      mockVolunteersService.create.mockRejectedValue(
        new ConflictException('A volunteer with this email already exists'),
      );

      await expect(controller.create(dto)).rejects.toThrow(
        new ConflictException('A volunteer with this email already exists'),
      );
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

  describe('updateHomebase', () => {
    it('changes the homebase through the service and returns the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        homebase: Homebase.SALEM,
        assignedCoordinators: [],
      } as FosterVolunteer;
      mockVolunteersService.changeHomebase.mockResolvedValue(volunteer);

      const result = await controller.updateHomebase(1, {
        homebase: Homebase.SALEM,
      } as UpdateHomebaseDto);

      expect(mockVolunteersService.changeHomebase).toHaveBeenCalledTimes(1);
      expect(mockVolunteersService.changeHomebase).toHaveBeenCalledWith(
        1,
        Homebase.SALEM,
      );
      expect(result).toBe(volunteer);
    });

    it('propagates errors thrown by the service', async () => {
      const error = new NotFoundException('Volunteer with ID 1 not found');
      mockVolunteersService.changeHomebase.mockRejectedValue(error);

      await expect(
        controller.updateHomebase(1, {
          homebase: Homebase.SALEM,
        } as UpdateHomebaseDto),
      ).rejects.toBe(error);
      expect(mockVolunteersService.changeHomebase).toHaveBeenCalledTimes(1);
    });
  });

  describe('UpdateHomebaseDto validation', () => {
    const errorsFor = (body: object) =>
      validate(plainToInstance(UpdateHomebaseDto, body));

    it.each(Object.values(Homebase))('accepts %p', async (homebase) => {
      expect(await errorsFor({ homebase })).toHaveLength(0);
    });

    it.each(['Narnia', 'boston', ' Boston', '', 42, null])(
      'rejects %p',
      async (homebase) => {
        const errors = await errorsFor({ homebase });

        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('homebase');
      },
    );

    it('rejects a missing homebase', async () => {
      const errors = await errorsFor({});

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('homebase');
    });
  });
});
