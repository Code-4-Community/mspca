import { Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { CoordinatorsService } from './coordinators.service';
import { validateId } from '../utils/validation.utils';
import { FosterCoordinator } from './coordinators.entity';

@Controller('coordinators')
export class CoordinatorsController {
  constructor(private coordinatorsService: CoordinatorsService) {}

  @Patch('/:id/deactivate')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');

    return this.coordinatorsService.deactivate(id);
  }

  @Patch('/:id/activate')
  async activate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');

    return this.coordinatorsService.activate(id);
  }
}
