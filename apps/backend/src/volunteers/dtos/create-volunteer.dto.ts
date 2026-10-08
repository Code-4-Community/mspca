import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Homebase } from '../../types';
import { FosterType } from '../volunteers.types';
import { ArrayNotEmpty } from 'class-validator';
import { IsArray } from 'class-validator';

export class CreateVolunteerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  secondaryPhone?: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  zipcode!: string;

  @IsEnum(Homebase)
  homebase!: Homebase;

  @IsString()
  @IsNotEmpty()
  residentAnimals!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(FosterType, { each: true })
  fosterType!: FosterType[];

  @IsOptional()
  @IsBoolean()
  completedCanineTraining?: boolean;
}
