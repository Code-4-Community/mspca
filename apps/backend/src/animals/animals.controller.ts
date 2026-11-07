import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnimalsService } from './animals.service';
import { Animal } from './animals.entity';

@ApiTags('Animals')
@Controller('animals')
export class AnimalsController {
  constructor(private animalsService: AnimalsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all available animals',
    description:
      'Returns every animal. All animals in the database are currently treated as available.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The animals, or an empty array when none are available.',
    type: [Animal],
  })
  async getAnimals(): Promise<Animal[]> {
    return this.animalsService.findAll();
  }
}
