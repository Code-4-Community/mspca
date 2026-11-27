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
import { StaffService } from './staff.service';
import { FosterStaff } from './staff.entity';
import { CreateStaffDto } from './dtos/create-staff.dto';
import { ConfirmStaffDto } from './dtos/confirm-staff.dto';
import { AssignCoordinatorsDto } from './dtos/assign-coordinators.dto';
import { Public } from '../aws/cognito/cognito.decorator';
import { validateId } from '../utils/validation.utils';

@ApiTags('Staff')
@Controller('staff')
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Create a staff member account',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'The staff member was created and a verification code was emailed',
    type: FosterStaff,
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
    description: 'Failed to register or save the staff member',
  })
  async create(@Body() dto: CreateStaffDto): Promise<FosterStaff> {
    return this.staffService.create(dto);
  }

  @Public()
  @Post('/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Confirm a staff member email',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description:
      'The email was confirmed and the staff member was assigned their Cognito role',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired verification code',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No staff member with this email exists',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many verification attempts',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to confirm the staff member',
  })
  async confirm(@Body() dto: ConfirmStaffDto): Promise<void> {
    await this.staffService.confirm(dto);
  }

  @Patch('/:id/deactivate')
  @ApiOperation({
    summary: 'Deactivate an active staff member',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Staff member ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The staff member was deactivated',
    type: FosterStaff,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid staff member ID or staff member is already inactive',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Staff member with the given ID does not exist',
  })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FosterStaff> {
    validateId(id, 'Staff member');
    return this.staffService.deactivate(id);
  }

  @Patch('/:id/activate')
  @ApiOperation({
    summary: 'Activate an inactive staff member',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Staff member ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The staff member was activated',
    type: FosterStaff,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid staff member ID or staff member is already active',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Staff member with the given ID does not exist',
  })
  async activate(@Param('id', ParseIntPipe) id: number): Promise<FosterStaff> {
    validateId(id, 'Staff member');
    return this.staffService.activate(id);
  }

  @Patch('/:id/coordinators')
  @ApiOperation({
    summary: 'Assign foster coordinators to a staff member',
    description:
      'Adds the given coordinators to an active staff member and emails them. Coordinators must exist and be active; homebase does not matter.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Staff member ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'The coordinators were assigned to the staff member and notified',
    type: FosterStaff,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Invalid staff member ID or coordinator IDs, the staff member or a coordinator is inactive, or a coordinator is already assigned',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The staff member or a coordinator does not exist',
  })
  async assignCoordinators(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCoordinatorsDto,
  ): Promise<FosterStaff> {
    validateId(id, 'Staff member');
    return this.staffService.assignCoordinators(id, dto.coordinatorIds);
  }
}
