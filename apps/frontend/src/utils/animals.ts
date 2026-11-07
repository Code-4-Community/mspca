import type { Animal } from '../types';

export interface Restriction {
  label: string;
  // Color token from theme.ts
  color: string;
}

export const RESTRICTIONS: readonly Restriction[] = [
  { label: 'No Restrictions', color: 'trello.noRestrictions' },
  { label: 'Dog-Free Home', color: 'trello.dogFreeHome' },
  { label: 'Cat-Free Home', color: 'trello.catFreeHome' },
  { label: 'Activity Restriction', color: 'trello.activityRestriction' },
  { label: 'Child-Free Home', color: 'trello.childFreeHome' },
  { label: 'Pet-Free Home', color: 'trello.petFreeHome' },
  { label: 'Requires Medication', color: 'trello.requiresMedication' },
];

export const getRestriction = (label: string): Restriction | undefined =>
  RESTRICTIONS.find((r) => r.label === label);

export const formatAge = (age: number): string =>
  `${age} ${age === 1 ? 'yr' : 'yrs'}`;

export const ANIMAL_TYPES = ['Cats', 'Dogs', 'Small Animals'] as const;
export type AnimalType = (typeof ANIMAL_TYPES)[number];

// TODO: the schema has no species field. Until it does, infer the type from the
// breed text: known small-animal and cat breeds are matched by word, and
// everything else is treated as a dog.
const SMALL_ANIMAL_PATTERN =
  /\b(rabbit|bunny|guinea pig|hamster|ferret|rat|gerbil|chinchilla|hedgehog|mouse|mice|degu)\b/;
const CAT_PATTERN =
  /\b(cat|shorthair|longhair|siamese|maine coon|tabby|persian|ragdoll|bengal|sphynx|calico|tuxedo|tortoiseshell|russian blue|british|abyssinian)\b/;

export const getAnimalType = (animal: Animal): AnimalType => {
  const breeds = animal.breed.join(' ').toLowerCase();
  if (SMALL_ANIMAL_PATTERN.test(breeds)) return 'Small Animals';
  if (CAT_PATTERN.test(breeds)) return 'Cats';
  return 'Dogs';
};

// "8 Address Street, Boston MA" -> "Boston"
export const getAnimalCity = (animal: Animal): string => {
  const lastPart = animal.location.split(',').pop()?.trim() ?? '';
  return lastPart.replace(/\s+[A-Za-z]{2}$/, '').trim() || animal.location;
};

export interface AnimalFilterState {
  types: string[];
  restrictions: string[];
  locations: string[];
}

export const EMPTY_FILTERS: AnimalFilterState = {
  types: [],
  restrictions: [],
  locations: [],
};

// All filtering happens client-side on the already-fetched list. Within
// Restrictions an animal must have every selected tag; within Animal Type and
// Location it may match any selected value. Empty categories match everything.
export const matchesFilters = (
  animal: Animal,
  filters: AnimalFilterState,
): boolean =>
  (filters.types.length === 0 ||
    filters.types.includes(getAnimalType(animal))) &&
  (filters.locations.length === 0 ||
    filters.locations.includes(getAnimalCity(animal))) &&
  filters.restrictions.every((label) => animal.restrictions?.includes(label));
