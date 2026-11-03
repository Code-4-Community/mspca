import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateMatchDto {
  @IsInt()
  @IsPositive()
  volunteerId!: number;

  @IsInt()
  @IsPositive()
  chameleonAnimalId!: number;

  @IsOptional()
  @IsString()
  additionalComments?: string;
}
