import { ArrayUnique, IsArray, IsEnum, ValidateIf } from 'class-validator';
import { UpdateVolunteerDto } from './update-volunteer.dto';
import { FosterTraining } from '../volunteers.types';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class CoordinatorUpdateVolunteerDto extends UpdateVolunteerDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsNonEmptyString()
  coordinatorNotes?: string;

  // Unlike @IsOptional, still validates null so it 400s instead of hitting NOT NULL.
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsEnum(FosterTraining, { each: true })
  completedTrainings?: FosterTraining[];
}
