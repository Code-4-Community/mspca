import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PetsService } from './pets.service';
import { Pet } from './pets.entity';

describe('PetsService', () => {
  let service: PetsService;
  let mockRepo: { find: jest.Mock; save: jest.Mock };

  const pet = (ageYear: number, ageMonth: number) =>
    ({ ageYear, ageMonth } as Pet);

  beforeEach(async () => {
    mockRepo = { find: jest.fn(), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: getRepositoryToken(Pet), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(PetsService);
  });

  describe('incrementAllAges', () => {
    it('adds one month to a pet under 11 months', async () => {
      mockRepo.find.mockResolvedValue([pet(1, 5)]);

      await service.incrementAllAges();

      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ ageYear: 1, ageMonth: 6 }),
      ]);
    });

    it('rolls 11 months into the next year', async () => {
      mockRepo.find.mockResolvedValue([pet(2, 11)]);

      await service.incrementAllAges();

      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ ageYear: 3, ageMonth: 0 }),
      ]);
    });

    it('increments every pet independently', async () => {
      mockRepo.find.mockResolvedValue([pet(0, 0), pet(0, 11), pet(4, 3)]);

      await service.incrementAllAges();

      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ ageYear: 0, ageMonth: 1 }),
        expect.objectContaining({ ageYear: 1, ageMonth: 0 }),
        expect.objectContaining({ ageYear: 4, ageMonth: 4 }),
      ]);
    });

    it('returns the number of pets updated', async () => {
      mockRepo.find.mockResolvedValue([pet(1, 1), pet(2, 2)]);

      await expect(service.incrementAllAges()).resolves.toBe(2);
    });

    it('does not save when there are no pets', async () => {
      mockRepo.find.mockResolvedValue([]);

      await expect(service.incrementAllAges()).resolves.toBe(0);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
