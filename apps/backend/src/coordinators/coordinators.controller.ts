import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoordinatorsService } from './coordinators.service';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { FosterCoordinator } from './coordinators.entity';
import { validateId } from '../utils/validation.utils';

@ApiTags('Coordinators')
@Controller('coordinators')
export class CoordinatorsController {
  constructor(private coordinatorsService: CoordinatorsService) {}

  // Intentionally protected: this endpoint provisions privileged staff accounts.
  @Post()
  @ApiOperation({ summary: 'Create a Foster Coordinator' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The created Coordinator',
    type: FosterCoordinator,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A coordinator with this email already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing or invalid fields',
  })
  async create(@Body() dto: CreateCoordinatorDto): Promise<FosterCoordinator> {
    return this.coordinatorsService.create(dto);
  }

  @ApiOperation({ summary: 'Deactivate a foster coordinator' })
  @ApiParam({ name: 'id', type: Number, description: 'Coordinator ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The coordinator was deactivated',
    type: FosterCoordinator,
  })
  @Patch('/:id/deactivate')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');
    return this.coordinatorsService.deactivate(id);
  }

  @ApiOperation({ summary: 'Activate a foster coordinator' })
  @ApiParam({ name: 'id', type: Number, description: 'Coordinator ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The coordinator was activated',
    type: FosterCoordinator,
  })
  @Patch('/:id/activate')
  async activate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');
    return this.coordinatorsService.activate(id);
  }
}
