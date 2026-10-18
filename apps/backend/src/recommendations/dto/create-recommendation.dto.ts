import { IsInt, IsPositive } from 'class-validator';

export class CreateRecommendationDTO {
  @IsInt()
  @IsPositive()
  volunteerId!: number;

  @IsInt()
  @IsPositive()
  chameleonAnimalId!: number;
}
