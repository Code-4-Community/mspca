import { Controller } from '@nestjs/common';
import { CoordinatorsService } from './coordinators.service';

@Controller('coordinators')
export class CoordinatorsController {
  constructor(private coordinatorsService: CoordinatorsService) {}
}
