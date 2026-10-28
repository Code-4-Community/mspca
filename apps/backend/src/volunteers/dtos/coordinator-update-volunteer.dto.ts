import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { UpdateVolunteerDto } from './update-volunteer.dto';
import { FosterTraining } from '../volunteers.types';

export class CoordinatorUpdateVolunteerDto extends UpdateVolunteerDto {
  @IsOptional()
  @IsString()
  coordinatorNotes?: string;

  // Unlike @IsOptional, still validates null so it 400s instead of hitting NOT NULL.
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsEnum(FosterTraining, { each: true })
  completedTrainings?: FosterTraining[];
}
