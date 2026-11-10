export interface Animal {
  animalId: number;
  chameleonAnimalId: string;
  name: string;
  // Whole years of age, e.g. 4 for "4Y5M"
  ageYear: number;
  // Remaining months of age, e.g. 5 for "4Y5M"
  ageMonth: number;
  sex: string;
  // 'Dog' | 'Cat' | 'Small Animals' | 'Baby Bottle Animals' | 'Farm Animals'
  species: string;
  breed: string[];
  weight: number;
  // 'Boston' | 'Cape Cod' | 'Salem' | 'Nevins Farm'
  location: string;
  pictures: string[];
  fosterBioMemo: string;
  // Restriction tag labels (e.g. 'Dog-Free Home')
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
  // 'Pending' | 'Active' | 'Complete' | 'Denied' | 'Withdrawn' | 'Canceled'
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
