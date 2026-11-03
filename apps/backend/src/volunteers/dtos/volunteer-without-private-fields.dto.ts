import { OmitType } from '@nestjs/swagger';
import { FosterVolunteer } from '../volunteers.entity';

export class VolunteerWithoutPrivateFields extends OmitType(FosterVolunteer, [
  'coordinatorNotes',
] as const) {}
