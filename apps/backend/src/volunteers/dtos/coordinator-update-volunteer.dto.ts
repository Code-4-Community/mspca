import { ArrayUnique, IsArray, IsEnum, ValidateIf } from 'class-validator';
import { UpdateVolunteerDto } from './update-volunteer.dto';
import { FosterTraining } from '../volunteers.types';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class CoordinatorUpdateVolunteerDto extends UpdateVolunteerDto {
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNonEmptyString()
  coordinatorNotes?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsEnum(FosterTraining, { each: true })
  completedTrainings?: FosterTraining[];
}
