import { IsOptional, IsString } from 'class-validator';
import { UpdateVolunteerDto } from './update-volunteer.dto';

export class CoordinatorUpdateVolunteerDto extends UpdateVolunteerDto {
  @IsOptional()
  @IsString()
  coordinatorNotes?: string;
}
