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

@ApiTags('Volunteers')
// @ApiBearerAuth()
@Controller('volunteers')
export class VolunteersController {
  constructor(
    private volunteersService: VolunteersService,
    private matchesService: MatchesService,
  ) {}

  // Public: volunteers sign up before they have an account to authenticate with.
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

  @ApiOperation({ summary: 'Deactivate a foster volunteer' })
  @ApiParam({ name: 'id', type: Number, description: 'Volunteer ID' })
  @ApiResponse({
    status: 200,
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

  @ApiOperation({ summary: 'Activate a foster volunteer' })
  @ApiParam({ name: 'id', type: Number, description: 'Volunteer ID' })
  @ApiResponse({
    status: 200,
    description: 'The volunteer was activated',
    type: FosterVolunteer,
  })
  @Patch('/:id/activate')
  async activate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');
    return this.volunteersService.activate(id);
  }
}
