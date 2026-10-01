import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';

// @ApiTags('Volunteers')
// @ApiBearerAuth()
@Controller('volunteers')
export class VolunteersController {
  constructor(private volunteersService: VolunteersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all volunteers' })
  @ApiResponse({
    status: 200,
    description: 'All volunteers, regardless of match status',
    type: [FosterVolunteer],
  })
  async getAllVolunteers(): Promise<FosterVolunteer[]> {
    return this.volunteersService.getAllVolunteers();
  }
}
