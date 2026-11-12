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
