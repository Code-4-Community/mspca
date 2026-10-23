import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';
import { Homebase } from '../../types';
import { FosterType } from '../volunteers.types';

export class CreateVolunteerDto {
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

  @IsOptional()
  @IsNonEmptyString()
  @IsPhoneNumber('US')
  @MaxLength(20)
  secondaryPhone?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Mirrors the Cognito user pool's password policy.
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @MaxLength(256)
  password!: string;

  @IsNonEmptyString()
  @MaxLength(255)
  address!: string;

  @IsNonEmptyString()
  @MaxLength(255)
  city!: string;

  @IsNonEmptyString()
  @MaxLength(10)
  zipcode!: string;

  @IsEnum(Homebase)
  homebase!: Homebase;

  @IsNonEmptyString()
  residentAnimals!: string;

  @IsOptional()
  @IsNonEmptyString()
  notes?: string;

  @IsEnum(FosterType)
  fosterType!: FosterType;
}
