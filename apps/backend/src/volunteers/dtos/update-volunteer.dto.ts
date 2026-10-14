import { Homebase } from '../../types';
import { FosterType } from '../volunteers.types';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  IsPhoneNumber,
  IsEmail,
} from 'class-validator';

export class UpdateVolunteerDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('US')
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('US')
  secondaryPhone?: string;

  @IsOptional()
  @IsNotEmpty()
  @MaxLength(255)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  zipcode?: string;

  @IsOptional()
  @IsEnum(Homebase)
  homebase?: Homebase;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  residentAnimals?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;

  @IsOptional()
  @IsEnum(FosterType)
  fosterType?: FosterType;
}
