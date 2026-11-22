export enum Homebase {
  BOSTON = 'Boston',
  CAPE_COD = 'Cape Cod',
  SALEM = 'Salem',
  NEVINS_FARM = 'Nevins Farm',
}

export enum FosterType {
  DOG = 'Dog',
  CAT = 'Cat',
  SMALL_ANIMALS = 'Small Animals',
  BABY_BOTTLE_ANIMALS = 'Baby Bottle Animals',
  FARM_ANIMALS = 'Farm Animals',
}

export enum FosterTraining {
  DOG = 'Dog',
  CAT = 'Cat',
}

export enum VolunteerStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending',
}

export enum MatchStatus {
  PENDING = 'Pending',
  ACTIVE = 'Active',
  COMPLETE = 'Complete',
  DENIED = 'Denied',
  WITHDRAWN = 'Withdrawn',
  CANCELED = 'Canceled',
}

export enum Restriction {
  NO_RESTRICTIONS = 'No Restrictions',
  DOG_FREE_HOME = 'Dog-Free Home',
  CAT_FREE_HOME = 'Cat-Free Home',
  ACTIVITY_RESTRICTION = 'Activity Restriction',
  CHILD_FREE_HOME = 'Child-Free Home',
  PET_FREE_HOME = 'Pet-Free Home',
  REQUIRES_MEDICATION = 'Requires Medication',
}

export interface Animal {
  animalId: number;
  chameleonAnimalId: string;
  name: string;
  ageYear: number;
  ageMonth: number;
  sex: string;
  species: FosterType;
  breed: string[];
  weight: number;
  location: Homebase;
  pictures: string[];
  fosterBioMemo: string;
  restrictions: Restriction[];
}

export interface CreateMatchBody {
  volunteerId: number;
  chameleonAnimalId: string;
  additionalComments?: string;
}

export interface Match {
  matchId: number;
  volunteerId: number;
  chameleonAnimalId: string;
  status: MatchStatus;
  additionalComments: string | null;
  deniedReason: string | null;
}

export interface Coordinator {
  coordinatorId: number;
  firstName: string;
  lastName: string;
  phone: string;
  secondaryPhone: string | null;
  email: string;
  homebase: Homebase;
  active: boolean;
  cognitoSub: string;
  // Only included when a coordinator is loaded with their volunteers (e.g. /api/auth/me).
  assignedVolunteers?: Volunteer[];
}

export interface Volunteer {
  volunteerId: number;
  firstName: string;
  lastName: string;
  phone: string;
  secondaryPhone: string | null;
  email: string;
  address: string;
  city: string;
  zipcode: string;
  homebase: Homebase;
  residentAnimals: string;
  notes: string | null;
  fosterType: FosterType[];
  animalUpdates: boolean;
  completedTrainings: FosterTraining[];
  mostRecentWaiverSigned: boolean;
  status: VolunteerStatus;
  fosterTypePreferences: FosterType[];
  cognitoSub: string;
  animalPreferences: string[];
  assignedCoordinators: Coordinator[];
}

// Must match the backend's CognitoRole values exactly, since /api/auth/me
// returns these strings as the user's role.
export enum UserRole {
  FOSTER_VOLUNTEER = 'FosterVolunteer',
  FOSTER_COORDINATOR = 'FosterCoordinator',
  OWNER = 'Owner',
}

export interface Owner {
  ownerId: number;
  firstName: string;
  lastName: string;
  phone: string;
  secondaryPhone: string | null;
  email: string;
  active: boolean;
  cognitoSub: string;
}

// The signed-in user returned by GET /api/auth/me: their role, plus their
// record from the table that matches that role.
export type AuthenticatedUser =
  | { role: UserRole.FOSTER_VOLUNTEER; user: Volunteer }
  | { role: UserRole.FOSTER_COORDINATOR; user: Coordinator }
  | { role: UserRole.OWNER; user: Owner };
