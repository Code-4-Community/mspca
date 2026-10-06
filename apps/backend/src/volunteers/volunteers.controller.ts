import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { validateId } from '../utils/validation.utils';
import { FosterVolunteer } from './volunteers.entity';

@ApiTags('Volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(
    private volunteersService: VolunteersService,
    private matchesService: MatchesService,
  ) {}

  @Get('/:volunteerId/matches')
  @ApiOperation({ summary: 'Get all Matches for a Volunteer' })
  @ApiParam({
    name: 'volunteerId',
    type: Number,
    description: 'ID of the Volunteer',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "The Volunteer's Matches",
    type: [Match],
  })
  async getVolunteerMatches(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
  ): Promise<Match[]> {
    validateId(volunteerId, 'Volunteer');

    await this.volunteersService.findByIdOrFail(volunteerId);

    return this.matchesService.findByVolunteerId(volunteerId);
  }

  @ApiOperation({ summary: 'Deactivate an active foster volunteer' })
  @ApiParam({ name: 'id', type: Number, description: 'Volunteer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The volunteer was deactivated',
    type: FosterVolunteer,
  })
  @Patch('/:id/deactivate')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');
    return this.volunteersService.deactivate(id);
  }

  @ApiOperation({ summary: 'Reactivate an inactive foster volunteer' })
  @ApiParam({ name: 'id', type: Number, description: 'Volunteer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The volunteer was reactivated',
    type: FosterVolunteer,
  })
  @Patch('/:id/reactivate')
  async reactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');
    return this.volunteersService.reactivate(id);
  }
}
