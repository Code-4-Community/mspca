import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OwnersService } from './owners.service';
import { Owner } from './owners.entity';
import { CreateOwnerDto } from './dtos/create-owner.dto';

@ApiTags('Owners')
@Controller('owners')
export class OwnersController {
  constructor(private ownersService: OwnersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an owner account',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The owner was created and a temporary password was emailed',
    type: Owner,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid profile fields',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'An account with this email already exists',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to create or save the owner',
  })
  async create(@Body() dto: CreateOwnerDto): Promise<Owner> {
    return this.ownersService.create(dto);
  }
}
