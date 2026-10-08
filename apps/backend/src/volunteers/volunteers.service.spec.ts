import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let repo: { findOne: jest.Mock };

  const mockVolunteers = [
    { volunteerId: 1, firstName: 'Jane', lastName: 'Doe' },
    { volunteerId: 2, firstName: 'John', lastName: 'Smith' },
  ] as FosterVolunteer[];

  const mockRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    repo = { findOne: jest.fn() };

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

  afterEach(() => {
    jest.clearAllMocks();
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
      const volunteer = { volunteerId: 7, active: true } as FosterVolunteer;
      repo.findOne.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      repo.findOne.mockResolvedValue({
        volunteerId: 7,
        active: false,
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
    });
  });
});
