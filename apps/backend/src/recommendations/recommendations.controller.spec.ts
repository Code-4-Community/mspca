import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './createRecommendation.dto';
import { VolunteersService } from '../volunteers/volunteers.service';

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let recommendationsService: { create: jest.Mock };
  let volunteersService: { existsById: jest.Mock };

  const body: CreateRecommendationDTO = {
    volunteerId: 7,
    chameleonAnimalId: 42,
  };

  beforeEach(async () => {
    recommendationsService = { create: jest.fn() };
    volunteersService = { existsById: jest.fn() };

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
    it('returns the created recommendation when the volunteer exists', async () => {
      const recommendation = { ...body, isActive: true } as Recommendation;
      volunteersService.existsById.mockResolvedValue(true);
      recommendationsService.create.mockResolvedValue(recommendation);

      const result = await controller.createRecommendation(body);

      expect(result).toBe(recommendation);
      expect(volunteersService.existsById).toHaveBeenCalledWith(7);
      expect(recommendationsService.create).toHaveBeenCalledWith(body);
    });

    it('throws NotFoundException when the volunteer does not exist', async () => {
      volunteersService.existsById.mockResolvedValue(false);

      await expect(controller.createRecommendation(body)).rejects.toThrow(
        NotFoundException,
      );
      expect(recommendationsService.create).not.toHaveBeenCalled();
    });

    it.each([
      ['volunteerId is missing', { chameleonAnimalId: 42 }],
      ['chameleonAnimalId is missing', { volunteerId: 7 }],
      ['the body is missing', undefined],
      [
        'volunteerId is not an integer',
        { volunteerId: 1.5, chameleonAnimalId: 42 },
      ],
      [
        'chameleonAnimalId is not an integer',
        { volunteerId: 7, chameleonAnimalId: 1.5 },
      ],
      [
        'volunteerId is not positive',
        { volunteerId: 0, chameleonAnimalId: 42 },
      ],
      [
        'chameleonAnimalId is not positive',
        { volunteerId: 7, chameleonAnimalId: -1 },
      ],
    ])('throws BadRequestException when %s', async (_case, invalidBody) => {
      await expect(
        controller.createRecommendation(
          invalidBody as unknown as CreateRecommendationDTO,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(volunteersService.existsById).not.toHaveBeenCalled();
      expect(recommendationsService.create).not.toHaveBeenCalled();
    });
  });

  it('responds 200 rather than the default 201 for a POST', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        RecommendationsController.prototype.createRecommendation,
      ),
    ).toBe(HttpStatus.OK);
  });
});
