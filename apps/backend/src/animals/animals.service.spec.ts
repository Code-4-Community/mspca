import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { AnimalsService } from './animals.service';
import { Animal } from './animals.entity';
import { Restriction } from './animals.types';
import { Homebase } from '../types';
import { FosterType } from '../volunteers/volunteers.types';

describe('AnimalsService', () => {
  let service: AnimalsService;
  let mockRepo: { findOneBy: jest.Mock; find: jest.Mock };

  const mockAnimal = {
    animalId: 1,
    chameleonAnimalId: 'A42',
    name: 'Biscuit',
    ageYear: 3,
    ageMonth: 2,
    sex: 'F',
    species: FosterType.DOG,
    breed: ['Beagle'],
    weight: 22.5,
    location: Homebase.BOSTON,
    pictures: ['https://example.com/biscuit.jpg'],
    fosterBioMemo: 'Loves walks',
    restrictions: [Restriction.CAT_FREE_HOME],
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

      const result = await service.findByChameleonIdOrFail('A42');

      expect(result).toBe(mockAnimal);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        chameleonAnimalId: 'A42',
      });
    });

    it('throws NotFoundException when no animal with the Chameleon ID exists', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findByChameleonIdOrFail('A999')).rejects.toThrow(
        new NotFoundException('Animal with Chameleon ID A999 not found'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({
        chameleonAnimalId: 'A999',
      });
    });
  });

  describe('checkAllExistOrFail', () => {
    it('does not throw when every Chameleon ID exists', async () => {
      mockRepo.find.mockResolvedValue([
        { ...mockAnimal, chameleonAnimalId: 'A42' },
        { ...mockAnimal, animalId: 2, chameleonAnimalId: 'A107' },
      ]);

      await expect(
        service.checkAllExistOrFail(['A42', 'A107']),
      ).resolves.toBeUndefined();
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { chameleonAnimalId: In(['A42', 'A107']) },
      });
    });

    it('throws NotFoundException listing every missing Chameleon ID', async () => {
      mockRepo.find.mockResolvedValue([
        { ...mockAnimal, chameleonAnimalId: 'A42' },
      ]);

      await expect(
        service.checkAllExistOrFail(['A42', 'A998', 'A999']),
      ).rejects.toThrow(
        new NotFoundException(
          'Animals with Chameleon IDs not found: A998, A999',
        ),
      );
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { chameleonAnimalId: In(['A42', 'A998', 'A999']) },
      });
    });

    it('does not query the database when given no IDs', async () => {
      await expect(service.checkAllExistOrFail([])).resolves.toBeUndefined();
      expect(mockRepo.find).not.toHaveBeenCalled();
    });
  });
});
