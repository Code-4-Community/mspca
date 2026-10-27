import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './dto/create-recommendation.dto';
import { VolunteersService } from '../volunteers/volunteers.service';
import { AnimalsService } from '../animals/animals.service';

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let recommendationsService: { create: jest.Mock };
  let volunteersService: { findActiveOrFail: jest.Mock };
  let animalsService: { findByChameleonIdOrFail: jest.Mock };

  const body = {
    volunteerId: 7,
    chameleonAnimalId: 'A42',
  } as CreateRecommendationDTO;

  beforeEach(async () => {
    recommendationsService = { create: jest.fn() };
    volunteersService = { findActiveOrFail: jest.fn() };
    animalsService = { findByChameleonIdOrFail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationsController],
      providers: [
        {
          provide: RecommendationsService,
          useValue: recommendationsService,
        },
        {
          provide: VolunteersService,
          useValue: volunteersService,
        },
        {
          provide: AnimalsService,
          useValue: animalsService,
        },
      ],
    }).compile();

    controller = module.get<RecommendationsController>(
      RecommendationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRecommendation', () => {
    it('returns the created recommendation when the volunteer is active and the animal exists', async () => {
      const recommendation = { ...body, isActive: true } as Recommendation;
      volunteersService.findActiveOrFail.mockResolvedValue({});
      animalsService.findByChameleonIdOrFail.mockResolvedValue({});
      recommendationsService.create.mockResolvedValue(recommendation);

      const result = await controller.createRecommendation(body);

      expect(result).toBe(recommendation);
      expect(volunteersService.findActiveOrFail).toHaveBeenCalledWith(7);
      expect(animalsService.findByChameleonIdOrFail).toHaveBeenCalledWith(
        'A42',
      );
      expect(recommendationsService.create).toHaveBeenCalledWith(body);
    });

    it('does not create a recommendation when the volunteer does not exist or is not active', async () => {
      const error = new NotFoundException();
      volunteersService.findActiveOrFail.mockRejectedValue(error);

      await expect(controller.createRecommendation(body)).rejects.toThrow(
        error,
      );
      expect(recommendationsService.create).not.toHaveBeenCalled();
    });

    it('does not create a recommendation when the animal does not exist', async () => {
      const error = new NotFoundException(
        'Animal with Chameleon ID A42 not found',
      );
      volunteersService.findActiveOrFail.mockResolvedValue({});
      animalsService.findByChameleonIdOrFail.mockRejectedValue(error);

      await expect(controller.createRecommendation(body)).rejects.toThrow(
        error,
      );
      expect(animalsService.findByChameleonIdOrFail).toHaveBeenCalledWith(
        'A42',
      );
      expect(recommendationsService.create).not.toHaveBeenCalled();
    });
  });
});
