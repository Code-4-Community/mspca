import { FosterVolunteer } from './volunteers.entity';

export enum FosterType {
  DOG = 'Dog',
  CAT = 'Cat',
  SMALL_ANIMALS = 'Small Animals',
  BABY_BOTTLE_ANIMALS = 'Baby Bottle Animals',
}

export enum VolunteerStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending',
}

export type VolunteerWithoutNotes = Omit<FosterVolunteer, 'coordinatorNotes'>;
