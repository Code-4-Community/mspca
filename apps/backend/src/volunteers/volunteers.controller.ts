import { Controller } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';

@Controller('volunteers')
export class VolunteersController {
  constructor(private volunteersService: VolunteersService) {}
}
