import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Homebase } from '../../types';

export class CreateCoordinatorDto {
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
  @IsPhoneNumber('US')
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('US')
  @MaxLength(20)
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

  @IsEnum(Homebase)
  homebase!: Homebase;
}
