import { IsEnum, IsInt, Max, MaxLength, Min } from 'class-validator';
import { FosterType } from '../volunteers.types';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class PetDto {
  @IsInt()
  @Min(0)
  @Max(50)
  ageYear!: number;

  @IsInt()
  @Min(0)
  @Max(11)
  ageMonth!: number;

  @IsEnum(FosterType)
  species!: FosterType;

  @IsNonEmptyString()
  @MaxLength(255)
  breed!: string;
}
