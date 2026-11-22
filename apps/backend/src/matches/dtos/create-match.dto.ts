import {
  IsInt,
  IsOptional,
  IsPositive,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

@ValidatorConstraint({ name: 'exactlyOneApplicant', async: false })
class ExactlyOneApplicantConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as CreateMatchDto;
    const hasVolunteer =
      obj.volunteerId !== undefined && obj.volunteerId !== null;
    const hasStaff = obj.staffId !== undefined && obj.staffId !== null;
    return (hasVolunteer && !hasStaff) || (!hasVolunteer && hasStaff);
  }

  defaultMessage(): string {
    return 'Exactly one of volunteerId or staffId must be provided';
  }
}

export class CreateMatchDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Validate(ExactlyOneApplicantConstraint)
  volunteerId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  staffId?: number;

  @IsNonEmptyString()
  @MaxLength(255)
  chameleonAnimalId!: string;
}
