import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { MatchesService } from '../matches/matches.service';
import { Match } from '../matches/matches.entity';
import { validateId } from '../utils/validation.utils';
import { FosterVolunteer } from './volunteers.entity';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { Public } from '../aws/cognito/cognito.decorator';
import { UpdateAnimalUpdatesDto } from './dtos/update-animal-updates.dto';

@ApiTags('Volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(
    private volunteersService: VolunteersService,
    private matchesService: MatchesService,
  ) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a foster volunteer account' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The volunteer was created and is pending approval',
    type: FosterVolunteer,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'A required field is missing or invalid',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A volunteer with this email already exists',
  })
  async create(@Body() dto: CreateVolunteerDto): Promise<FosterVolunteer> {
    return this.volunteersService.create(dto);
  }

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

  @ApiOperation({
    summary: 'Opt a foster volunteer in or out of animal updates',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Volunteer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The volunteer was updated',
    type: FosterVolunteer,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The ID is malformed or the body is not a boolean',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No volunteer with this ID exists',
  })
  @Patch('/:id/animal-updates')
  async updateAnimalUpdates(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnimalUpdatesDto,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');
    return this.volunteersService.updateAnimalUpdates(id, dto);
  }
}
