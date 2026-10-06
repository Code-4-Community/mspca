import { IsInt, IsPositive } from 'class-validator';

export class CreateMatchDto {
  @IsInt()
  @IsPositive()
  volunteerId!: number;

  @IsInt()
  @IsPositive()
  chameleonAnimalId!: number;
}
