import { IsBoolean } from 'class-validator';

export class UpdateAnimalUpdatesDto {
  @IsBoolean()
  animalUpdates!: boolean;
}
