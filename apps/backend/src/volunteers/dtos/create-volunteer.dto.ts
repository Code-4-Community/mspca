import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';
import { Homebase } from '../../types';
import { FosterTraining, FosterType } from '../volunteers.types';
import { PetDto } from './pet.dto';

export class CreateVolunteerDto {
  @IsNonEmptyString()
  @MaxLength(255)
  firstName!: string;

  @IsNonEmptyString()
  @MaxLength(255)
  lastName!: string;

  @IsNonEmptyString()
  @IsPhoneNumber('US')
  @MaxLength(255)
  phone!: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNonEmptyString()
  @IsPhoneNumber('US')
  @MaxLength(20)
  secondaryPhone?: string | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
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

  @IsBoolean()
  hasChildren!: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  childrenAges?: number[];

  @IsBoolean()
  hasSeparateFosterRoom!: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PetDto)
  pets?: PetDto[];

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNonEmptyString()
  notes?: string | null;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(FosterType, { each: true })
  fosterType!: FosterType[];

  // Unlike @IsOptional, still validates null so it 400s instead of hitting NOT NULL.
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(FosterTraining, { each: true })
  completedTrainings?: FosterTraining[];
}
