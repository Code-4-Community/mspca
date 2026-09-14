import { Controller } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';

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
}
