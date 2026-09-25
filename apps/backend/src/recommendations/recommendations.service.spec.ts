import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let repo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: getRepositoryToken(Recommendation),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('saves a recommendation for the volunteer and animal', async () => {
      const result = await service.create({
        volunteerId: 7,
        chameleonAnimalId: 42,
      });

      expect(repo.create).toHaveBeenCalledWith({
        volunteerId: 7,
        chameleonAnimalId: 42,
        isActive: true,
      });
      expect(repo.save).toHaveBeenCalledWith({
        volunteerId: 7,
        chameleonAnimalId: 42,
        isActive: true,
      });
      expect(result).toEqual({
        volunteerId: 7,
        chameleonAnimalId: 42,
        isActive: true,
      });
    });

    it('defaults new recommendations to active', async () => {
      const result = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 2,
      });

      expect(result.isActive).toBe(true);
    });

    it('returns the saved entity from the repository', async () => {
      const saved = {
        volunteerId: 7,
        chameleonAnimalId: 42,
        isActive: true,
      } as Recommendation;
      repo.save.mockResolvedValue(saved);

      const result = await service.create({
        volunteerId: 7,
        chameleonAnimalId: 42,
      });

      expect(result).toBe(saved);
    });
  });
});
