import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './dto/create-recommendation.dto';
import { VolunteersService } from '../volunteers/volunteers.service';
import { AnimalsService } from '../animals/animals.service';
import { validateId } from '../utils/validation.utils';

@ApiTags('Recommendations')
// @ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private recommendationsService: RecommendationsService,
    private volunteersService: VolunteersService,
    private animalsService: AnimalsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Recommend a Chameleon Animal to an active Volunteer',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The created or reactivated recommendation',
    type: Recommendation,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The volunteer or animal does not exist',
  })
  async createRecommendation(
    @Body() body: CreateRecommendationDTO,
  ): Promise<Recommendation> {
    validateId(body.volunteerId, 'Volunteer');

    await this.volunteersService.findActiveOrFail(body.volunteerId);
    await this.animalsService.findByChameleonIdOrFail(body.chameleonAnimalId);

    return this.recommendationsService.create(body);
  }
}
