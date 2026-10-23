import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { ConfirmCoordinatorDto } from './dtos/confirm-coordinator.dto';
import { Public } from '../aws/cognito/cognito.decorator';
import { validateId } from '../utils/validation.utils';

@ApiTags('Coordinators')
@Controller('coordinators')
export class CoordinatorsController {
  constructor(private coordinatorsService: CoordinatorsService) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Create a foster coordinator account',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'The coordinator was created and a verification code was emailed',
    type: FosterCoordinator,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid profile fields or password',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'An account with this email already exists',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to register or save the coordinator',
  })
  async create(@Body() dto: CreateCoordinatorDto): Promise<FosterCoordinator> {
    return this.coordinatorsService.create(dto);
  }

  @Public()
  @Post('/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Confirm a foster coordinator email',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description:
      'The email was confirmed and the coordinator was assigned their Cognito role',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired verification code',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No coordinator with this email exists',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many verification attempts',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to confirm the coordinator',
  })
  async confirm(@Body() dto: ConfirmCoordinatorDto): Promise<void> {
    await this.coordinatorsService.confirm(dto);
  }

  @Patch('/:id/deactivate')
  @ApiOperation({
    summary: 'Deactivate an active foster coordinator',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Coordinator ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The coordinator was deactivated',
    type: FosterCoordinator,
  })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');
    return this.coordinatorsService.deactivate(id);
  }

  @Patch('/:id/activate')
  @ApiOperation({
    summary: 'Activate an inactive foster coordinator',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Coordinator ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The coordinator was activated',
    type: FosterCoordinator,
  })
  async activate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterCoordinator> {
    validateId(id, 'Coordinator');
    return this.coordinatorsService.activate(id);
  }
}
