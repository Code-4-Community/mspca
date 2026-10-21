import { FosterType } from '../volunteers.types';
import {
  IsOptional,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  IsPhoneNumber,
  IsEmail,
} from 'class-validator';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class UpdateVolunteerDto {
  @IsOptional()
  @IsNonEmptyString()
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsNonEmptyString()
  @MaxLength(255)
  lastName?: string;

  @IsOptional()
  @IsNonEmptyString()
  @IsPhoneNumber('US')
  phone?: string;

  @IsOptional()
  @IsNonEmptyString()
  @IsPhoneNumber('US')
  secondaryPhone?: string;

  @IsOptional()
  @IsNotEmpty()
  @MaxLength(255)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNonEmptyString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsNonEmptyString()
  @MaxLength(255)
  city?: string;

  @IsOptional()
  @IsNonEmptyString()
  @MaxLength(10)
  zipcode?: string;

  @IsOptional()
  @IsNonEmptyString()
  residentAnimals?: string;

  @IsOptional()
  @IsNonEmptyString()
  notes?: string;

  @IsOptional()
  @IsEnum(FosterType)
  fosterType?: FosterType;
}
