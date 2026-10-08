import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Homebase } from '../../types';

// Accepts every FosterCoordinator field except `active` (defaults to true) and
// `assignedVolunteers` (defaults to []), which are not client-settable on create.
export class CreateCoordinatorDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string | null;

  @IsEmail()
  @Matches(/^[^\s@]+@mspca\.org$/, {
    message: 'Email must end in @mspca.org',
  })
  email!: string;

  @IsEnum(Homebase)
  homebase!: Homebase;
}
