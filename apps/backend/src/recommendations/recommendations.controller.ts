import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './createRecommendation.dto';
import { VolunteersService } from '../volunteers/volunteers.service';
import { validateId } from '../utils/validation.utils';

// @ApiTags('Recommendations')
// @ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private recommendationsService: RecommendationsService,
    private volunteersService: VolunteersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async createRecommendation(
    @Body() body: CreateRecommendationDTO,
  ): Promise<Recommendation> {
    validateId(body?.volunteerId, 'volunteer');
    validateId(body?.chameleonAnimalId, 'Chameleon animal');

    if (!(await this.volunteersService.existsById(body.volunteerId))) {
      throw new NotFoundException(
        `Volunteer with ID ${body.volunteerId} not found`,
      );
    }

    return this.recommendationsService.create(body);
  }
}
