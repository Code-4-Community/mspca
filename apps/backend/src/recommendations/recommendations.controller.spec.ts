import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './createRecommendation.dto';
import { VolunteersService } from '../volunteers/volunteers.service';

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let recommendationsService: { create: jest.Mock };
  let volunteersService: { findActiveOrFail: jest.Mock };

  const body = {
    volunteerId: 7,
    chameleonAnimalId: 42,
  } as CreateRecommendationDTO;

  beforeEach(async () => {
    recommendationsService = { create: jest.fn() };
    volunteersService = { findActiveOrFail: jest.fn() };

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
    it('returns the created recommendation when the volunteer is active', async () => {
      const recommendation = { ...body, isActive: true } as Recommendation;
      volunteersService.findActiveOrFail.mockResolvedValue({});
      recommendationsService.create.mockResolvedValue(recommendation);

      const result = await controller.createRecommendation(body);

      expect(result).toBe(recommendation);
      expect(volunteersService.findActiveOrFail).toHaveBeenCalledWith(7);
      expect(recommendationsService.create).toHaveBeenCalledWith(body);
    });

    it.each([
      ['does not exist', new NotFoundException()],
      ['is not active', new BadRequestException()],
    ])(
      'does not create a recommendation when the volunteer %s',
      async (_case, error) => {
        volunteersService.findActiveOrFail.mockRejectedValue(error);

        await expect(controller.createRecommendation(body)).rejects.toThrow(
          error,
        );
        expect(recommendationsService.create).not.toHaveBeenCalled();
      },
    );
  });
});
