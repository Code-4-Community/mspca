import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
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

  describe('setStatus', () => {
    describe('deactivating', () => {
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

        const result = await service.setStatus(1, VolunteerStatus.INACTIVE);

        expect(repo.findOne).toHaveBeenCalledWith({
          where: { volunteerId: 1 },
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

        await expect(
          service.setStatus(999, VolunteerStatus.INACTIVE),
        ).rejects.toThrow(
          new NotFoundException('Volunteer with ID 999 not found'),
        );
        expect(repo.save).not.toHaveBeenCalled();
      });
    });

    describe('activating', () => {
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

        const result = await service.setStatus(1, VolunteerStatus.ACTIVE);

        expect(repo.findOne).toHaveBeenCalledWith({
          where: { volunteerId: 1 },
        });
        expect(repo.save).toHaveBeenCalledWith({
          ...volunteer,
          status: VolunteerStatus.ACTIVE,
        });
        expect(result.status).toBe(VolunteerStatus.ACTIVE);
      });

      it('throws NotFoundException if volunteer does not exist', async () => {
        repo.findOne.mockResolvedValue(null);

        await expect(
          service.setStatus(999, VolunteerStatus.ACTIVE),
        ).rejects.toThrow(
          new NotFoundException('Volunteer with ID 999 not found'),
        );
        expect(repo.save).not.toHaveBeenCalled();
      });
    });
  });
});
