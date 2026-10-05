import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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

  describe('findByIdOrFail', () => {
    it('returns the volunteer when one with the id exists', async () => {
      const volunteer = { volunteerId: 7 } as FosterVolunteer;
      repo.findOneBy.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(repo.findOneBy).toHaveBeenCalledWith({ volunteerId: 7 });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(repo.findOneBy).toHaveBeenCalledWith({ volunteerId: 7 });
    });
  });
});
