import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let repo: { findOneBy: jest.Mock };

  beforeEach(async () => {
    repo = { findOneBy: jest.fn() };

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

  describe('findActiveOrFail', () => {
    it('returns the volunteer when they are active', async () => {
      const volunteer = { volunteerId: 7, active: true } as FosterVolunteer;
      repo.findOneBy.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
      expect(repo.findOneBy).toHaveBeenCalledWith({ volunteerId: 7 });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      repo.findOneBy.mockResolvedValue({ volunteerId: 7, active: false });

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
