import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { UpdateFosterTypePreferencesDto } from './dto/update-foster-type-preferences.dto';
import { Match } from '../matches/matches.entity';

describe('VolunteersController', () => {
  let controller: VolunteersController;

  const mockVolunteersService = {
    findByIdOrFail: jest.fn(),
    findActiveOrFail: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
    updateVolunteerById: jest.fn(),
    updateFosterTypePreferences: jest.fn(),
    approve: jest.fn(),
    getAllVolunteers: jest.fn(),
  };

  const mockMatchesService = {
    findByVolunteerId: jest.fn(),
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
    jest.clearAllMocks();

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
        await expect(
          controller.updateFosterTypePreferences(
            1,
            body as UpdateFosterTypePreferencesDto,
          ),
        ).rejects.toThrow(BadRequestException);
        expect(
          mockVolunteersService.updateFosterTypePreferences,
        ).not.toHaveBeenCalled();
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
});
