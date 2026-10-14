import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { EmailsService } from '../aws/ses/email.service';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
    assignedCoordinator: null,
  } as FosterVolunteer;

  let mockRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let emailsService: { sendEmail: jest.Mock };

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
    emailsService = { sendEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: getRepositoryToken(FosterVolunteer), useValue: mockRepo },
        { provide: EmailsService, useValue: emailsService },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer when one with the id exists', async () => {
      const volunteer = { volunteerId: 7 } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });
  });

  describe('findActiveOrFail', () => {
    it('returns the volunteer when they are active', async () => {
      const volunteer = {
        volunteerId: 7,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      const checkSpy = jest.spyOn(service, 'checkVolunteerActive');

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
      expect(checkSpy).toHaveBeenCalledWith(volunteer);
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      const volunteer = {
        volunteerId: 7,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      const checkSpy = jest.spyOn(service, 'checkVolunteerActive');

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 7 is not active'),
      );
      expect(checkSpy).toHaveBeenCalledWith(volunteer);
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
    });
  });

  describe('checkVolunteerActive', () => {
    const makeVolunteer = (status: VolunteerStatus) =>
      ({ volunteerId: 1, status } as FosterVolunteer);

    it('does not throw for an active volunteer', () => {
      expect(() =>
        service.checkVolunteerActive(makeVolunteer(VolunteerStatus.ACTIVE)),
      ).not.toThrow();
    });

    it('throws BadRequestException for a volunteer who is not active', () => {
      expect(() =>
        service.checkVolunteerActive(makeVolunteer(VolunteerStatus.INACTIVE)),
      ).toThrow(new BadRequestException('Volunteer with ID 1 is not active'));
    });
  });

  describe('deactivate', () => {
    it('sets status to Inactive, saves, and does not delete the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });

      const result = await service.deactivate(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already inactive', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('sets status to Active and saves the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });

      const result = await service.reactivate(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.reactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already active', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateVolunteerById', () => {
    it('should update and return the volunteer with only the given fields changed', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = { notes: 'updated notes' } as UpdateVolunteerDto;
      const result = await service.updateVolunteerById(1, dto);

      expect(result.notes).toBe('updated notes');
      expect(result.firstName).toBe('Jane');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        notes: 'updated notes',
      });
    });

    it('should update multiple allowed fields at once', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = {
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
      } as UpdateVolunteerDto;

      const result = await service.updateVolunteerById(1, dto);

      expect(result.address).toBe('123 Main St');
      expect(result.city).toBe('Boston');
      expect(result.zipcode).toBe('02115');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
      });
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVolunteerById(999, { notes: 'x' }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    const pendingVolunteer = () =>
      ({
        volunteerId: 1,
        firstName: 'Jane',
        email: 'jane@example.com',
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer);

    it('sets status to Active, saves, and emails the volunteer', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (v) => v);
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      const result = await service.approve(1);

      expect(findSpy).toHaveBeenCalledWith(1);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VolunteerStatus.ACTIVE }),
      );
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith({
        toEmail: 'jane@example.com',
        subject: expect.any(String),
        bodyHtml: expect.stringContaining('Jane'),
      });
    });

    it('throws ConflictException and does not send an email if the volunteer is not pending', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...pendingVolunteer(),
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.approve(1)).rejects.toThrow(
        new ConflictException('Only pending Volunteers can be approved'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      await expect(service.approve(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(findSpy).toHaveBeenCalledWith(999);
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('still approves the volunteer if the email fails to send', async () => {
      mockRepo.findOne.mockResolvedValue(pendingVolunteer());
      mockRepo.save.mockImplementation(async (v) => v);
      emailsService.sendEmail.mockRejectedValue(new Error('SES down'));
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      const result = await service.approve(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VolunteerStatus.ACTIVE }),
      );
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('getAllVolunteers', () => {
    it('should return all volunteers', async () => {
      mockRepo.find.mockResolvedValue(mockVolunteers);

      const result = await service.getAllVolunteers();

      expect(result).toEqual(mockVolunteers);
      expect(mockRepo.find).toHaveBeenCalled();
    });

    it('should return an empty array when there are no volunteers', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getAllVolunteers();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalled();
    });
  });

  describe('updateAnimalPreferences', () => {
    const volunteerWithPreferences = (animalPreferences: number[]) =>
      ({ ...mockVolunteer, animalPreferences } as FosterVolunteer);

    beforeEach(() => {
      mockRepo.save.mockImplementation(async (v) => v);
    });

    it('adds the given animal IDs to the list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([42]));
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      const result = await service.updateAnimalPreferences(1, {
        added: [107, 230],
      });

      expect(findSpy).toHaveBeenCalledWith(1);
      expect(result).toEqual([42, 107, 230]);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ animalPreferences: [42, 107, 230] }),
      );
    });

    it('removes the given animal IDs from the list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([42, 107]));

      const result = await service.updateAnimalPreferences(1, {
        removed: [42],
      });

      expect(result).toEqual([107]);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ animalPreferences: [107] }),
      );
    });

    it('applies removals and additions in the same request', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([42, 107]));

      const result = await service.updateAnimalPreferences(1, {
        added: [55],
        removed: [107],
      });

      expect(result).toEqual([42, 55]);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ animalPreferences: [42, 55] }),
      );
    });

    it('does not create duplicates when adding an ID already in the list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([42]));

      const result = await service.updateAnimalPreferences(1, {
        added: [42, 55, 55],
      });

      expect(result).toEqual([42, 55]);
    });

    it('throws BadRequestException when a removed ID is not in the list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([42]));

      await expect(
        service.updateAnimalPreferences(1, { removed: [42, 999] }),
      ).rejects.toThrow(
        new BadRequestException(
          "Animal IDs not in the volunteer's preferences: 999",
        ),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when an ID is in both added and removed', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([42, 107]));

      await expect(
        service.updateAnimalPreferences(1, { added: [42, 55], removed: [42] }),
      ).rejects.toThrow(
        new BadRequestException(
          'Animal IDs cannot be both added and removed: 42',
        ),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when removing from an empty list', async () => {
      mockRepo.findOne.mockResolvedValue(volunteerWithPreferences([]));

      await expect(
        service.updateAnimalPreferences(1, { removed: [42] }),
      ).rejects.toThrow(
        new BadRequestException(
          'Volunteer with ID 1 has no animal preferences to remove',
        ),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const findSpy = jest.spyOn(service, 'findByIdOrFail');

      await expect(
        service.updateAnimalPreferences(999, { added: [42] }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(findSpy).toHaveBeenCalledWith(999);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
