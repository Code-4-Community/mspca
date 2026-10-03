import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let repo: { upsert: jest.Mock; findOneByOrFail: jest.Mock };

  const saved = {
    volunteerId: 7,
    chameleonAnimalId: 42,
    isActive: true,
  } as Recommendation;

  beforeEach(async () => {
    repo = {
      upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
      findOneByOrFail: jest.fn().mockResolvedValue(saved),
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
    it('upserts the recommendation as active on the composite key', async () => {
      await service.create({ volunteerId: 7, chameleonAnimalId: 42 });

      expect(repo.upsert).toHaveBeenCalledWith(
        { volunteerId: 7, chameleonAnimalId: 42, isActive: true },
        ['volunteerId', 'chameleonAnimalId'],
      );
    });

    it('reactivates an inactive recommendation for the same pair', async () => {
      // The existing (7, 42) row is inactive. Upserting on the composite key
      // overwrites it with isActive: true rather than inserting a duplicate.
      const result = await service.create({
        volunteerId: 7,
        chameleonAnimalId: 42,
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
        chameleonAnimalId: 42,
      });

      expect(result).toBe(saved);
      expect(repo.findOneByOrFail).toHaveBeenCalledWith({
        volunteerId: 7,
        chameleonAnimalId: 42,
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

      await service.create({ volunteerId: 7, chameleonAnimalId: 42 });

      expect(order).toEqual(['upsert', 'read']);
    });
  });
});
