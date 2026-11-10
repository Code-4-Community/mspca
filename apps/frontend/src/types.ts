export interface Animal {
  animalId: number;
  chameleonAnimalId: string;
  name: string;
  ageYear: number;
  ageMonth: number;
  sex: string;
  species: string;
  breed: string[];
  weight: number;
  location: string;
  pictures: string[];
  fosterBioMemo: string;
  restrictions: string[];
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
  homebase: string;
  residentAnimals: string;
  notes: string | null;
  fosterType: string[];
  animalUpdates: boolean;
  completedTrainings: string[];
  mostRecentWaiverSigned: boolean;
  status: string;
  cognitoSub: string;
  animalPreferences: string[];
  assignedCoordinators: Coordinator[];
}
