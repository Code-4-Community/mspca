import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';

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

  describe('deactivate', () => {
    it('should set active to false and save the volunteer', async () => {
      const volunteer = { volunteerId: 1, active: true } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({ ...volunteer, active: false });

      const result = await service.deactivate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
      });
      expect(repo.save).toHaveBeenCalledWith({ ...volunteer, active: false });
      expect(result.active).toBe(false);
    });

    it('should throw NotFoundException if volunteer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
    it('should not delete the volunteer record', async () => {
      const volunteer = { volunteerId: 1, active: true } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({ ...volunteer, active: false });

      await service.deactivate(1);

      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should set active to true and save the volunteer', async () => {
      const volunteer = { volunteerId: 1, active: false } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({ ...volunteer, active: true });

      const result = await service.activate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
      });
      expect(repo.save).toHaveBeenCalledWith({ ...volunteer, active: true });
      expect(result.active).toBe(true);
    });

    it('should throw NotFoundException if volunteer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
