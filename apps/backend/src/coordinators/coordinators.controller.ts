import { Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoordinatorsService } from './coordinators.service';
import { validateId } from '../utils/validation.utils';
import { FosterCoordinator } from './coordinators.entity';

@ApiTags('Coordinators')
@Controller('coordinators')
export class CoordinatorsController {
  constructor(private coordinatorsService: CoordinatorsService) {}

  @ApiOperation({ summary: 'Deactivate a foster coordinator' })
  @ApiParam({ name: 'id', type: Number, description: 'Coordinator ID' })
  @ApiResponse({
    status: 200,
    description: 'The coordinator was deactivated',
    type: FosterCoordinator,
  })
  @Patch('/:id/deactivate')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');
    return this.coordinatorsService.setActive(id, false);
  }

  @ApiOperation({ summary: 'Activate a foster coordinator' })
  @ApiParam({ name: 'id', type: Number, description: 'Coordinator ID' })
  @ApiResponse({
    status: 200,
    description: 'The coordinator was activated',
    type: FosterCoordinator,
  })
  @Patch('/:id/activate')
  async activate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');
    return this.coordinatorsService.setActive(id, true);
  }
}
