import { IsInt, IsPositive, MaxLength, ValidateIf } from 'class-validator';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';
import { ExactlyOne } from './validators/exactly-one.validator';

@ExactlyOne<CreateMatchDto>(['volunteerId', 'staffId'])
export class CreateMatchDto {
  @ValidateIf((o) => o.volunteerId !== undefined)
  @IsInt()
  @IsPositive()
  volunteerId?: number;

  @ValidateIf((o) => o.staffId !== undefined)
  @IsInt()
  @IsPositive()
  staffId?: number;

  @IsNonEmptyString()
  @MaxLength(255)
  chameleonAnimalId!: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNonEmptyString()
  additionalComments?: string;
}
