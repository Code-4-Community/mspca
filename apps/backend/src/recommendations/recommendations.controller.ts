import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './createRecommendation.dto';
import { VolunteersService } from '../volunteers/volunteers.service';
import { validateId } from '../utils/validation.utils';

@ApiTags('Recommendations')
// @ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private recommendationsService: RecommendationsService,
    private volunteersService: VolunteersService,
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
  async createRecommendation(
    @Body() body: CreateRecommendationDTO,
  ): Promise<Recommendation> {
    validateId(body.volunteerId, 'Volunteer');
    validateId(body.chameleonAnimalId, 'Chameleon Animal');

    await this.volunteersService.findActiveOrFail(body.volunteerId);

    return this.recommendationsService.create(body);
  }
}
