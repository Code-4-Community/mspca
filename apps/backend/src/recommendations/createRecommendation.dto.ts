import { IsInt, IsPositive } from 'class-validator';

/**
 * Request body for POST /recommendations. A recommendation points a
 * volunteer at an animal in Chameleon before any formal match exists.
 */
export class CreateRecommendationDTO {
  @IsInt()
  @IsPositive()
  volunteerId!: number;

  @IsInt()
  @IsPositive()
  chameleonAnimalId!: number;
}
