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

export interface Volunteer {
  volunteerId: number;
  firstName: string;
  lastName: string;
}
