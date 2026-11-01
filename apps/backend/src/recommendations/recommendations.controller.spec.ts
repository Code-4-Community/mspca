import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './dto/create-recommendation.dto';

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let recommendationsService: { create: jest.Mock };

  const body = {
    volunteerId: 7,
    chameleonAnimalId: 'A42',
  } as CreateRecommendationDTO;

  beforeEach(async () => {
    recommendationsService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationsController],
      providers: [
        {
          provide: RecommendationsService,
          useValue: recommendationsService,
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
    it('returns the recommendation created by the service', async () => {
      const recommendation = { ...body, isActive: true } as Recommendation;
      recommendationsService.create.mockResolvedValue(recommendation);

      const result = await controller.createRecommendation(body);

      expect(result).toBe(recommendation);
      expect(recommendationsService.create).toHaveBeenCalledWith(body);
    });

    it('surfaces errors from the service', async () => {
      const error = new NotFoundException(
        'Animal with Chameleon ID A42 not found',
      );
      recommendationsService.create.mockRejectedValue(error);

      await expect(controller.createRecommendation(body)).rejects.toThrow(
        error,
      );
    });
  });
});
