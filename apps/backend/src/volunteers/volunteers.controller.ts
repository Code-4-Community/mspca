import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { validateId } from '../utils/validation.utils';

// @ApiTags('Volunteers')
// @ApiBearerAuth()
@Controller('volunteers')
export class VolunteersController {
  constructor(
    private volunteersService: VolunteersService,
    private matchesService: MatchesService,
  ) {}

  // Example endpoint
  // @Get('/:userId')
  // async getUser(@Param('userId', ParseIntPipe) userId: number): Promise<User> {
  //   return this.usersService.findOne(userId);
  // }

  @Get('/:volunteerId/matches')
  async getVolunteerMatches(
    @Param('volunteerId') volunteerId: string,
  ): Promise<Match[]> {
    const id = Number(volunteerId);
    validateId(id, 'volunteer');

    if (!(await this.volunteersService.existsById(id))) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    return this.matchesService.findByVolunteerId(id);
  }
}
