import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { VolunteersService } from '../volunteers/volunteers.service';
import { AnimalsService } from '../animals/animals.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let repo: { upsert: jest.Mock; findOneByOrFail: jest.Mock };
  let volunteersService: { findActiveOrFail: jest.Mock };
  let animalsService: { findByChameleonIdOrFail: jest.Mock };

  const saved = {
    volunteerId: 7,
    chameleonAnimalId: 'A42',
    isActive: true,
  } as Recommendation;

  beforeEach(async () => {
    repo = {
      upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
      findOneByOrFail: jest.fn().mockResolvedValue(saved),
    };
    volunteersService = { findActiveOrFail: jest.fn().mockResolvedValue({}) };
    animalsService = {
      findByChameleonIdOrFail: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: getRepositoryToken(Recommendation),
          useValue: repo,
        },
        { provide: VolunteersService, useValue: volunteersService },
        { provide: AnimalsService, useValue: animalsService },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('upserts the recommendation as active on the composite key', async () => {
      await service.create({ volunteerId: 7, chameleonAnimalId: 'A42' });

      expect(repo.upsert).toHaveBeenCalledWith(
        { volunteerId: 7, chameleonAnimalId: 'A42', isActive: true },
        ['volunteerId', 'chameleonAnimalId'],
      );
    });

    it('reactivates an inactive recommendation for the same pair', async () => {
      const result = await service.create({
        volunteerId: 7,
        chameleonAnimalId: 'A42',
      });

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
        ['volunteerId', 'chameleonAnimalId'],
      );
      expect(result.isActive).toBe(true);
    });

    it('returns the persisted recommendation', async () => {
      const result = await service.create({
        volunteerId: 7,
        chameleonAnimalId: 'A42',
      });

      expect(result).toBe(saved);
      expect(repo.findOneByOrFail).toHaveBeenCalledWith({
        volunteerId: 7,
        chameleonAnimalId: 'A42',
      });
    });

    it('reads the row back only after the upsert has resolved', async () => {
      const order: string[] = [];
      repo.upsert.mockImplementation(async () => {
        order.push('upsert');
      });
      repo.findOneByOrFail.mockImplementation(async () => {
        order.push('read');
        return saved;
      });

      await service.create({ volunteerId: 7, chameleonAnimalId: 'A42' });

      expect(order).toEqual(['upsert', 'read']);
    });

    it('checks the volunteer is active, then that the animal exists, before saving', async () => {
      const order: string[] = [];
      volunteersService.findActiveOrFail.mockImplementation(async () => {
        order.push('volunteer');
      });
      animalsService.findByChameleonIdOrFail.mockImplementation(async () => {
        order.push('animal');
      });
      repo.upsert.mockImplementation(async () => {
        order.push('upsert');
      });

      await service.create({ volunteerId: 7, chameleonAnimalId: 'A42' });

      expect(volunteersService.findActiveOrFail).toHaveBeenCalledWith(7);
      expect(animalsService.findByChameleonIdOrFail).toHaveBeenCalledWith(
        'A42',
      );
      expect(order).toEqual(['volunteer', 'animal', 'upsert']);
    });

    it('throws without checking the animal or saving when the volunteer does not exist', async () => {
      const error = new NotFoundException('Volunteer with ID 7 not found');
      volunteersService.findActiveOrFail.mockRejectedValue(error);

      await expect(
        service.create({ volunteerId: 7, chameleonAnimalId: 'A42' }),
      ).rejects.toThrow(error);
      expect(animalsService.findByChameleonIdOrFail).not.toHaveBeenCalled();
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('throws without saving when the volunteer is not active', async () => {
      const error = new BadRequestException(
        'Volunteer with ID 7 is not active',
      );
      volunteersService.findActiveOrFail.mockRejectedValue(error);

      await expect(
        service.create({ volunteerId: 7, chameleonAnimalId: 'A42' }),
      ).rejects.toThrow(error);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('throws without saving when the animal does not exist', async () => {
      const error = new NotFoundException(
        'Animal with Chameleon ID A42 not found',
      );
      animalsService.findByChameleonIdOrFail.mockRejectedValue(error);

      await expect(
        service.create({ volunteerId: 7, chameleonAnimalId: 'A42' }),
      ).rejects.toThrow(error);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });
});
