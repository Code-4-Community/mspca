import {
  Controller,
  Patch,
  Get,
  Param,
  Body,
  HttpStatus,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { validateId } from '../utils/validation.utils';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { FosterVolunteer } from './volunteers.entity';

@ApiTags('Volunteers')
// @ApiBearerAuth()
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

  @Get('/:volunteerId')
  @ApiOperation({ summary: 'Get a volunteer by ID' })
  @ApiParam({
    name: 'volunteerId',
    type: Number,
    description: 'ID of the volunteer',
  })
  @ApiResponse({
    status: 200,
    description: 'The volunteer was found',
    type: FosterVolunteer,
  })
  async getVolunteerById(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
  ): Promise<FosterVolunteer> {
    validateId(volunteerId, 'FosterVolunteer');
    return this.volunteersService.getVolunteerById(volunteerId);
  }

  @Patch('/:volunteerId')
  @ApiOperation({ summary: 'Update a volunteer by ID' })
  @ApiParam({
    name: 'volunteerId',
    type: Number,
    description: 'ID of the volunteer',
  })
  @ApiResponse({
    status: 200,
    description: 'The volunteer was updated',
    type: FosterVolunteer,
  })
  async updateVolunteerById(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Body() dto: UpdateVolunteerDto,
  ): Promise<FosterVolunteer> {
    validateId(volunteerId, 'FosterVolunteer');
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }
    return this.volunteersService.updateVolunteerById(volunteerId, dto);
  }
}
