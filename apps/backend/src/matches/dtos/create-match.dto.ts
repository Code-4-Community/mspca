import { IsInt, IsPositive, MaxLength } from 'class-validator';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class CreateMatchDto {
  @IsInt()
  @IsPositive()
  volunteerId!: number;

  @IsNonEmptyString()
  @MaxLength(255)
  chameleonAnimalId!: string;
}
