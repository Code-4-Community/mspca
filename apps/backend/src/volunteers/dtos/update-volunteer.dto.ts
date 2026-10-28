import { Homebase } from '../../types';
import { FosterType } from '../volunteers.types';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  IsPhoneNumber,
  IsEmail,
  ArrayUnique,
  ValidateIf,
} from 'class-validator';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class UpdateVolunteerDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  @MaxLength(255)
  firstName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  @MaxLength(255)
  lastName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  @IsPhoneNumber('US')
  phone?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNonEmptyString()
  @IsPhoneNumber('US')
  secondaryPhone?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsNotEmpty()
  @MaxLength(255)
  @IsEmail()
  email?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  @MaxLength(255)
  address?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  @MaxLength(255)
  city?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  @MaxLength(10)
  zipcode?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(Homebase)
  homebase?: Homebase;

  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  residentAnimals?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNonEmptyString()
  notes?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(FosterType, { each: true })
  fosterType?: FosterType[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  animalUpdates?: boolean;
}
