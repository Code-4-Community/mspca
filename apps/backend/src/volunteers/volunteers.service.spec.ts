import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let repo: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: repo,
        },
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
      repo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(repo.findOne).toHaveBeenCalledWith({
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
      repo.findOne.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      repo.findOne.mockResolvedValue({
        volunteerId: 7,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 7 is not active'),
      );
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
    });
  });

  describe('deactivate', () => {
    it('sets status to Inactive, saves, and does not delete the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });

      const result = await service.deactivate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(repo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already inactive', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('sets status to Active and saves the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });

      const result = await service.reactivate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(repo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.reactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already active', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});