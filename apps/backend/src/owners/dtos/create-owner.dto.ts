import {
  IsEmail,
  IsPhoneNumber,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class CreateOwnerDto {
  @IsNonEmptyString()
  @MaxLength(255)
  firstName!: string;

  @IsNonEmptyString()
  @MaxLength(255)
  lastName!: string;

  @IsNonEmptyString()
  @IsPhoneNumber('US')
  @MaxLength(20)
  phone!: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNonEmptyString()
  @MaxLength(20)
  @IsPhoneNumber('US')
  secondaryPhone?: string | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  @Matches(/^[^\s@]+@mspca\.org$/, {
    message: 'Email must end in @mspca.org',
  })
  email!: string;
}
