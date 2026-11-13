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
  status: string;
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
  // 'Boston' | 'Cape Cod' | 'Salem' | 'Nevins Farm'
  homebase: string;
  active: boolean;
  cognitoSub: string;
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
  // 'Boston' | 'Cape Cod' | 'Salem' | 'Nevins Farm'
  homebase: string;
  residentAnimals: string;
  notes: string | null;
  // Each is 'Dog' | 'Cat' | 'Small Animals' | 'Baby Bottle Animals' | 'Farm Animals'
  fosterType: string[];
  animalUpdates: boolean;
  // Each is 'Dog' | 'Cat'
  completedTrainings: string[];
  mostRecentWaiverSigned: boolean;
  // 'Active' | 'Inactive' | 'Pending'
  status: string;
  cognitoSub: string;
  animalPreferences: string[];
  assignedCoordinators: Coordinator[];
}
