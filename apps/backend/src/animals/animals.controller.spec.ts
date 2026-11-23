import { Test, TestingModule } from '@nestjs/testing';
import { AnimalsController } from './animals.controller';
import { AnimalsService } from './animals.service';
import { Animal } from './animals.entity';

describe('AnimalsController', () => {
  let controller: AnimalsController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnimalsController],
      providers: [{ provide: AnimalsService, useValue: service }],
    }).compile();

    controller = module.get<AnimalsController>(AnimalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAnimals', () => {
    it('returns the animals from the service', async () => {
      const animals = [{ animalId: 1 }, { animalId: 2 }] as Animal[];
      service.findAll.mockResolvedValue(animals);

      await expect(controller.getAnimals()).resolves.toBe(animals);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when there are no animals', async () => {
      service.findAll.mockResolvedValue([]);

      await expect(controller.getAnimals()).resolves.toEqual([]);
    });

    it('propagates service errors', async () => {
      service.findAll.mockRejectedValue(new Error('db down'));

      await expect(controller.getAnimals()).rejects.toThrow('db down');
    });
  });
});
