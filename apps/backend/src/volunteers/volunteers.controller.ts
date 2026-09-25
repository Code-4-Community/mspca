import { Controller, Patch, Get, Param, Body } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { validateId } from '../utils/validation.utils';
import { NotFoundException } from '@nestjs/common';
import { UpdateVolunteerDto } from './update-volunteer.dto';

// @ApiTags('Volunteers')
// @ApiBearerAuth()
@Controller('volunteers')
export class VolunteersController {
  constructor(private volunteersService: VolunteersService) {}

  // Example endpoint
  // @Get('/:userId')
  // async getUser(@Param('userId', ParseIntPipe) userId: number): Promise<User> {
  //   return this.usersService.findOne(userId);
  // }

  @Get('/:volunteerId')
  async getVolunteerById(@Param('volunteerId') volunteerId: string) {
    validateId(Number(volunteerId), 'FosterVolunteer');
    const volunteer = await this.volunteersService.getVolunteerById(Number(volunteerId));
    if (!volunteer) {
      throw new NotFoundException('Volunteer not found');
    }
    return volunteer;
  }

  @Patch('/:volunteerId')
  async updateVolunteerbyId(@Param('volunteerId') volunteerId: string, @Body() dto: UpdateVolunteerDto) {
    validateId(Number(volunteerId), 'FosterVolunteer');
    const volunteer = await this.volunteersService.updateVolunteerbyId(Number(volunteerId), dto);
    if (!volunteer) {
      throw new NotFoundException('Volunteer not found');
    }
    return volunteer;
  }

}
