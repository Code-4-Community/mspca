import { Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { validateId } from '../utils/validation.utils';
import { FosterVolunteer } from './volunteers.entity';

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

  @Patch('/:id/deactivate')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');

    return this.volunteersService.deactivate(id);
  }

  @Patch('/:id/activate')
  async activate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');

    return this.volunteersService.activate(id);
  }
}
