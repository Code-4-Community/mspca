import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { UpdateVolunteerDto } from './update-volunteer.dto';
import { FosterTraining } from '../volunteers.types';

export class CoordinatorUpdateVolunteerDto extends UpdateVolunteerDto {
  @IsOptional()
  @IsString()
  coordinatorNotes?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(FosterTraining, { each: true })
  completedTrainings?: FosterTraining[];
}
