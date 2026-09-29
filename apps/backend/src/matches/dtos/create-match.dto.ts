import { IsInt, Min } from 'class-validator';

export class CreateMatchDto {
  @IsInt()
  @Min(1)
  volunteerId!: number;

  @IsInt()
  @Min(1)
  chameleonAnimalId!: number;
}
