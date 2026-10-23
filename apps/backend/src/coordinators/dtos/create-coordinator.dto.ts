import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsStrongPassword,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Homebase } from '../../types';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class CreateCoordinatorDto {
  @IsNonEmptyString()
  @MaxLength(255)
  firstName!: string;

  @IsNonEmptyString()
  @MaxLength(255)
  lastName!: string;

  @IsNonEmptyString()
  @IsPhoneNumber('US')
  phone!: string;

  @IsOptional()
  @IsNonEmptyString()
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

  @IsNonEmptyString()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @MaxLength(256)
  password!: string;

  @IsEnum(Homebase)
  homebase!: Homebase;
}
