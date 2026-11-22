import {
  IsInt,
  IsPositive,
  MaxLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

@ValidatorConstraint({ name: 'exactlyOneApplicant', async: false })
class ExactlyOneApplicantConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as CreateMatchDto;
    const hasVolunteer = obj.volunteerId !== undefined;
    const hasStaff = obj.staffId !== undefined;
    return (hasVolunteer && !hasStaff) || (!hasVolunteer && hasStaff);
  }

  defaultMessage(): string {
    return 'Exactly one of volunteerId or staffId must be provided';
  }
}

export class CreateMatchDto {
  @ValidateIf((o) => o.volunteerId !== undefined)
  @IsInt()
  @IsPositive()
  @Validate(ExactlyOneApplicantConstraint)
  volunteerId?: number;

  @ValidateIf((o) => o.staffId !== undefined)
  @IsInt()
  @IsPositive()
  staffId?: number;

  @IsNonEmptyString()
  @MaxLength(255)
  chameleonAnimalId!: string;
}
