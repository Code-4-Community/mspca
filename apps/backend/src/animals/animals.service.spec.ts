import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { AnimalsService } from './animals.service';
import { Animal } from './animals.entity';

describe('AnimalsService', () => {
  let service: AnimalsService;
  let mockRepo: { findOneBy: jest.Mock; find: jest.Mock };

  const mockAnimal = {
    animalId: 1,
    chameleonAnimalId: 42,
    name: 'Biscuit',
    age: 3,
    sex: 'Female',
    breed: ['Beagle'],
    weight: 22.5,
    location: 'Boston',
    picture: null,
    fosterBioMemo: null,
  } as Animal;

  beforeEach(async () => {
    mockRepo = { findOneBy: jest.fn(), find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnimalsService,
        { provide: getRepositoryToken(Animal), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AnimalsService>(AnimalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByChameleonIdOrFail', () => {
    it('returns the animal when one with the Chameleon ID exists', async () => {
      mockRepo.findOneBy.mockResolvedValue(mockAnimal);

      const result = await service.findByChameleonIdOrFail(42);

      expect(result).toBe(mockAnimal);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        chameleonAnimalId: 42,
      });
    });

    it('throws NotFoundException when no animal with the Chameleon ID exists', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findByChameleonIdOrFail(999)).rejects.toThrow(
        new NotFoundException('Animal with Chameleon ID 999 not found'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        chameleonAnimalId: 999,
      });
    });
  });

  describe('checkAllExistOrFail', () => {
    it('does not throw when every Chameleon ID exists', async () => {
      mockRepo.find.mockResolvedValue([
        { ...mockAnimal, chameleonAnimalId: 42 },
        { ...mockAnimal, animalId: 2, chameleonAnimalId: 107 },
      ]);

      await expect(
        service.checkAllExistOrFail([42, 107]),
      ).resolves.toBeUndefined();
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { chameleonAnimalId: In([42, 107]) },
      });
    });

    it('throws NotFoundException listing every missing Chameleon ID', async () => {
      mockRepo.find.mockResolvedValue([
        { ...mockAnimal, chameleonAnimalId: 42 },
      ]);

      await expect(service.checkAllExistOrFail([42, 998, 999])).rejects.toThrow(
        new NotFoundException('Animals with Chameleon IDs not found: 998, 999'),
      );
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { chameleonAnimalId: In([42, 998, 999]) },
      });
    });

    it('does not query the database when given no IDs', async () => {
      await expect(service.checkAllExistOrFail([])).resolves.toBeUndefined();
      expect(mockRepo.find).not.toHaveBeenCalled();
    });
  });
});
