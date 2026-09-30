import {
  Controller,
  Patch,
  Get,
  Param,
  Body,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { validateId } from '../utils/validation.utils';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { FosterVolunteer } from './volunteers.entity';

// @ApiTags('Volunteers')
// @ApiBearerAuth()
@Controller('volunteers')
export class VolunteersController {
  constructor(private volunteersService: VolunteersService) {}

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
    if (dto.volunteerId !== volunteerId) {
      throw new BadRequestException('volunteerId in path and body must match');
    }
    const fields = Object.keys(dto).filter((key) => key !== 'volunteerId');
    if (fields.length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }
    return this.volunteersService.updateVolunteerById(volunteerId, dto);
  }
}
