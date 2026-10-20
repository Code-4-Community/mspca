import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { EmailsService } from '../aws/ses/email.service';
import { Homebase } from '../types';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '123-456-7890',
    secondaryPhone: null,
    email: 'jane@example.com',
    address: '123 Main St',
    city: 'Boston',
    zipcode: '02115',
    homebase: Homebase.BOSTON,
    residentAnimals: 'Cats',
    fosterType: FosterType.CAT,
    completedCanineTraining: null,
    mostRecentWaiverSigned: true,
    status: VolunteerStatus.ACTIVE,
    fosterTypePreferences: [FosterType.CAT],
    assignedCoordinator: null,
    notes: 'Likes cats',
  } as FosterVolunteer;

  let mockRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  let emailsService: {
    sendEmail: jest.Mock;
  };

  const mockVolunteers = [
    { volunteerId: 1, firstName: 'Jane', lastName: 'Doe' },
    { volunteerId: 2, firstName: 'John', lastName: 'Smith' },
  ] as FosterVolunteer[];

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    emailsService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: mockRepo,
        },
        {
          provide: EmailsService,
          useValue: emailsService,
        },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockVolunteer);

      const result = await service.findByIdOrFail(1);

      expect(result).toBe(mockVolunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when the volunteer is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('findActiveOrFail', () => {
    it('returns an active volunteer', async () => {
      const volunteer = {
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;

      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(1);

      expect(result).toBe(volunteer);
    });

    it('rejects an inactive volunteer', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.INACTIVE,
      });

      await expect(service.findActiveOrFail(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkVolunteerActive', () => {
    it('does not throw for an active volunteer', () => {
      expect(() =>
        service.checkVolunteerActive({
          ...mockVolunteer,
          status: VolunteerStatus.ACTIVE,
        }),
      ).not.toThrow();
    });

    it('throws for an inactive volunteer', () => {
      expect(() =>
        service.checkVolunteerActive({
          ...mockVolunteer,
          status: VolunteerStatus.INACTIVE,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('deactivate', () => {
    it('deactivates an active volunteer', async () => {
      const volunteer = {
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      };

      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.deactivate(1);

      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.INACTIVE,
        }),
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a nonexistent volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(NotFoundException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a volunteer who is not active', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.INACTIVE,
      });

      await expect(service.deactivate(1)).rejects.toThrow(BadRequestException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('reactivates an inactive volunteer', async () => {
      const volunteer = {
        ...mockVolunteer,
        status: VolunteerStatus.INACTIVE,
      };

      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockImplementation(async (v) => v);

      const result = await service.reactivate(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.ACTIVE,
        }),
      );
    });

    it('throws NotFoundException for a nonexistent volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.reactivate(999)).rejects.toThrow(NotFoundException);
    });

    it('rejects a volunteer who is not inactive', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.reactivate(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateVolunteerById', () => {
    it('updates and saves the volunteer', async () => {
      const dto = {
        notes: 'Updated notes',
      } as UpdateVolunteerDto;

      const updated = {
        ...mockVolunteer,
        ...dto,
      };

      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.updateVolunteerById(1, dto);

      expect(result).toEqual(updated);
      expect(mockRepo.save).toHaveBeenCalledWith(updated);
    });

    it('throws NotFoundException when the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVolunteerById(999, {
          notes: 'Updated notes',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateFosterTypePreferences', () => {
    const volunteerWithPreferences = (
      fosterTypePreferences: FosterType[],
      status: VolunteerStatus = VolunteerStatus.ACTIVE,
    ): FosterVolunteer => ({
      ...mockVolunteer,
      status,
      fosterTypePreferences,
    });

    beforeEach(() => {
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);
    });

    it('adds new foster types to the existing list', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        added: [FosterType.CAT, FosterType.SMALL_ANIMALS],
      });
      expect(result).toEqual([
        FosterType.DOG,
        FosterType.CAT,
        FosterType.SMALL_ANIMALS,
      ]);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fosterTypePreferences: result }),
      );
    });

    it('adds a preference to an empty list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([]));
      const result = await service.updateFosterTypePreferences(1, {
        added: [FosterType.DOG],
      });
      expect(result).toEqual([FosterType.DOG]);
    });

    it('removes an existing preference', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([
          FosterType.DOG,
          FosterType.CAT,
          FosterType.SMALL_ANIMALS,
        ]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        removed: [FosterType.CAT, FosterType.SMALL_ANIMALS],
      });
      expect(result).toEqual([FosterType.DOG]);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fosterTypePreferences: [FosterType.DOG] }),
      );
    });

    it('removes all existing preferences', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG, FosterType.CAT]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        removed: [FosterType.DOG, FosterType.CAT],
      });
      expect(result).toEqual([]);
    });

    it('applies valid removals and additions together', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG, FosterType.CAT]),
      );
      const result = await service.updateFosterTypePreferences(1, {
        added: [FosterType.BABY_BOTTLE_ANIMALS],
        removed: [FosterType.DOG],
      });
      expect(result).toEqual([FosterType.CAT, FosterType.BABY_BOTTLE_ANIMALS]);
    });

    it('rejects adding an existing preference without saving or mutating', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
        }),
      ).rejects.toThrow(
        `Foster type preferences already exist: ${FosterType.DOG}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects duplicate additions in the same request', async () => {
      const volunteer = volunteerWithPreferences([]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT, FosterType.CAT],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(volunteer.fosterTypePreferences).toEqual([]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects removing a nonexistent preference without saving or mutating', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.CAT],
        }),
      ).rejects.toThrow(
        `Foster types not in the volunteer's preferences: ${FosterType.CAT}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects removing from an empty preference list', async () => {
      const volunteer = volunteerWithPreferences([]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG],
        }),
      ).rejects.toThrow(
        'Volunteer with ID 1 has no foster type preferences to remove',
      );
      expect(volunteer.fosterTypePreferences).toEqual([]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('reports multiple invalid removals together', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.CAT, FosterType.SMALL_ANIMALS],
        }),
      ).rejects.toThrow(
        `Foster types not in the volunteer's preferences: ${FosterType.CAT}, ${FosterType.SMALL_ANIMALS}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid removal even if other removals are valid', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG, FosterType.CAT],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects overlapping additions and removals', async () => {
      const volunteer = volunteerWithPreferences([FosterType.DOG]);
      mockRepo.findOne.mockResolvedValue(volunteer);
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
          removed: [FosterType.DOG],
        }),
      ).rejects.toThrow(
        `Foster types cannot be both added and removed: ${FosterType.DOG}`,
      );
      expect(volunteer.fosterTypePreferences).toEqual([FosterType.DOG]);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it.each([VolunteerStatus.PENDING, VolunteerStatus.INACTIVE])(
      'rejects a volunteer with status %s',
      async (status) => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithPreferences([FosterType.DOG], status),
        );
        await expect(
          service.updateFosterTypePreferences(1, {
            added: [FosterType.CAT],
          }),
        ).rejects.toThrow('Volunteer with ID 1 is not active');
        expect(mockRepo.save).not.toHaveBeenCalled();
      },
    );

    it('throws NotFoundException for a nonexistent volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateFosterTypePreferences(999, {
          added: [FosterType.DOG],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an empty update', async () => {
      mockRepo.findOne.mockResolvedValue(
        volunteerWithPreferences([FosterType.DOG]),
      );
      await expect(service.updateFosterTypePreferences(1, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('propagates database save errors', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([]));
      mockRepo.save.mockRejectedValue(new Error('db failure'));
      await expect(
        service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
        }),
      ).rejects.toThrow('db failure');
    });
  });

  describe('approve', () => {
    const pendingVolunteer = (): FosterVolunteer => ({
      ...mockVolunteer,
      status: VolunteerStatus.PENDING,
    });

    it('approves a pending volunteer and sends an email', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);

      const result = await service.approve(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.ACTIVE,
        }),
      );

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'jane@example.com',
        }),
      );
    });

    it('throws ConflictException if the volunteer is not pending', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockVolunteer,
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.approve(1)).rejects.toThrow(ConflictException);

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.approve(999)).rejects.toThrow(NotFoundException);

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('keeps the approval if sending the email fails', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (volunteer) => volunteer);
      emailsService.sendEmail.mockRejectedValue(new Error('SES down'));

      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      const result = await service.approve(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VolunteerStatus.ACTIVE,
        }),
      );
      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });

  describe('getAllVolunteers', () => {
    it('returns all volunteers', async () => {
      mockRepo.find.mockResolvedValue(mockVolunteers);

      const result = await service.getAllVolunteers();

      expect(result).toEqual(mockVolunteers);
      expect(mockRepo.find).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when no volunteers exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getAllVolunteers();

      expect(result).toEqual([]);
    });
  });
});
