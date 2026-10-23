import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
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
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';
import { FosterVolunteer } from './volunteers.entity';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dtos/confirm-volunteer.dto';
import { Public } from '../aws/cognito/cognito.decorator';

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
    description:
      'The volunteer was created and is pending approval; a verification code was emailed to them',
    type: FosterVolunteer,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'A required field is missing or invalid, or the password does not meet the policy',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A volunteer with this email already exists',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'The Cognito user could not be created; or the volunteer could not be saved and the Cognito user was deleted; ' +
      'or the save and the Cognito cleanup both failed (the orphaned Cognito user is logged)',
  })
  async create(@Body() dto: CreateVolunteerDto): Promise<FosterVolunteer> {
    return this.volunteersService.create(dto);
  }

  @Public()
  @Post('/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Confirm a foster volunteer's email with their verification code",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The email was confirmed and the volunteer can sign in',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'The code is not 6 digits, is wrong or has expired, or the volunteer cannot be confirmed or is already confirmed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No volunteer with this email exists',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many attempts; try again later',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'Confirmation failed, or the volunteer could not be given their role and their Cognito user was deleted',
  })
  async confirm(@Body() dto: ConfirmVolunteerDto): Promise<void> {
    await this.volunteersService.confirm(dto);
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
      "Invalid volunteer or animal IDs, the volunteer is not active, neither list has IDs, an ID is in both lists, or a removed ID is not in the volunteer's preferences",
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
