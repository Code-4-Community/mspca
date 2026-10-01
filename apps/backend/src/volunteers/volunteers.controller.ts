import { Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { validateId } from '../utils/validation.utils';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';

@ApiTags('Volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(private volunteersService: VolunteersService) {}

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
    return this.volunteersService.setStatus(id, VolunteerStatus.INACTIVE);
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
    return this.volunteersService.setStatus(id, VolunteerStatus.ACTIVE);
  }
}
