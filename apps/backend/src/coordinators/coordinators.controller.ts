import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoordinatorsService } from './coordinators.service';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { FosterCoordinator } from './coordinators.entity';

@ApiTags('Coordinators')
// @ApiBearerAuth()
@Controller('coordinators')
export class CoordinatorsController {
  constructor(private coordinatorsService: CoordinatorsService) {}

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
}
