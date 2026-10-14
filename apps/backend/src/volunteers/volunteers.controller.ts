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
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';
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

  @Get('/:volunteerId')
  @ApiOperation({ summary: 'Get a volunteer by ID' })
  @ApiParam({
    name: 'volunteerId',
    type: Number,
    description: 'ID of the volunteer',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The volunteer was found',
    type: FosterVolunteer,
  })
  async getVolunteerById(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
  ): Promise<FosterVolunteer> {
    validateId(volunteerId, 'Volunteer');
    return this.volunteersService.findByIdOrFail(volunteerId);
  }

  @Patch('/:volunteerId')
  @ApiOperation({ summary: 'Update a volunteer by ID' })
  @ApiParam({
    name: 'volunteerId',
    type: Number,
    description: 'ID of the volunteer',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The volunteer was updated',
    type: FosterVolunteer,
  })
  async updateVolunteerById(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Body() dto: UpdateVolunteerDto,
  ): Promise<FosterVolunteer> {
    validateId(volunteerId, 'Volunteer');
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }
    return this.volunteersService.updateVolunteerById(volunteerId, dto);
  }

  @ApiOperation({ summary: 'Approve a pending foster volunteer' })
  @ApiParam({ name: 'id', type: Number, description: 'Volunteer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The volunteer was approved and emailed',
    type: FosterVolunteer,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid ID',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The volunteer does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The volunteer is not pending',
  })
  @Patch('/:id/approve')
  async approve(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');
    return this.volunteersService.approve(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all volunteers' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All volunteers, regardless of match status',
    type: [FosterVolunteer],
  })
  async getAllVolunteers(): Promise<FosterVolunteer[]> {
    return this.volunteersService.getAllVolunteers();
  }

  @Patch('/:volunteerId/animal-preferences')
  @ApiOperation({ summary: "Update a volunteer's animal preferences" })
  @ApiParam({
    name: 'volunteerId',
    type: Number,
    description: 'ID of the volunteer',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "The volunteer's updated list of Chameleon animal IDs",
    type: [Number],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      "Invalid volunteer or animal IDs, neither list has IDs, an ID is in both lists, or a removed ID is not in the volunteer's preferences",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The volunteer does not exist',
  })
  async updateAnimalPreferences(
    @Param('volunteerId', ParseIntPipe) volunteerId: number,
    @Body() dto: UpdateAnimalPreferencesDto,
  ): Promise<number[]> {
    validateId(volunteerId, 'Volunteer');
    if (!dto.added?.length && !dto.removed?.length) {
      throw new BadRequestException(
        'At least one of added or removed must be provided',
      );
    }
    return this.volunteersService.updateAnimalPreferences(volunteerId, dto);
  }
}
