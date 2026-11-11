import { FosterType } from '../volunteers.types';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  Max,
  MaxLength,
  Min,
  IsPhoneNumber,
  IsEmail,
  ArrayUnique,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';
import { PetDto } from './pet.dto';

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
  @IsBoolean()
  hasChildren?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(25, { each: true })
  childrenAges?: number[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  hasSeparateFosterRoom?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PetDto)
  pets?: PetDto[];

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
