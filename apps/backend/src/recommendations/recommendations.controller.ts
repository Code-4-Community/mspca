import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './dto/create-recommendation.dto';
import { validateId } from '../utils/validation.utils';

@ApiTags('Recommendations')
// @ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private recommendationsService: RecommendationsService) {}

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

    return this.recommendationsService.create(body);
  }
}
