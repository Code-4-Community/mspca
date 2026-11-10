import { FosterType, Homebase, Restriction, type Animal } from '../types';

export interface RestrictionOption {
  label: Restriction;
  // Color token from theme.ts
  color: string;
}

const RESTRICTION_COLORS: Record<Restriction, string> = {
  [Restriction.NO_RESTRICTIONS]: 'trello.noRestrictions',
  [Restriction.DOG_FREE_HOME]: 'trello.dogFreeHome',
  [Restriction.CAT_FREE_HOME]: 'trello.catFreeHome',
  [Restriction.ACTIVITY_RESTRICTION]: 'trello.activityRestriction',
  [Restriction.CHILD_FREE_HOME]: 'trello.childFreeHome',
  [Restriction.PET_FREE_HOME]: 'trello.petFreeHome',
  [Restriction.REQUIRES_MEDICATION]: 'trello.requiresMedication',
};

export const RESTRICTIONS: readonly RestrictionOption[] = Object.values(
  Restriction,
).map((label) => ({ label, color: RESTRICTION_COLORS[label] }));

export const getRestriction = (label: Restriction): RestrictionOption => ({
  label,
  color: RESTRICTION_COLORS[label],
});

export const formatAge = (age: number): string =>
  `${age} ${age === 1 ? 'yr' : 'yrs'}`;

export const ANIMAL_TYPES: readonly FosterType[] = Object.values(FosterType);

// Exact address of each homebase, shown wherever an animal's location is.
export const HOMEBASE_ADDRESSES: Record<Homebase, string> = {
  [Homebase.BOSTON]: '350 South Huntington Ave, Boston, MA 02130',
  [Homebase.CAPE_COD]: '1577 Falmouth Rd, Centerville, MA 02632',
  [Homebase.SALEM]: '347 Highland Ave, Salem, MA 01970',
  [Homebase.NEVINS_FARM]: '400 Broadway, Methuen, MA 01844',
};

export interface AnimalFilterState {
  types: FosterType[];
  restrictions: Restriction[];
  locations: Homebase[];
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
  (filters.types.length === 0 || filters.types.includes(animal.species)) &&
  (filters.locations.length === 0 ||
    filters.locations.includes(animal.location)) &&
  filters.restrictions.every((label) => animal.restrictions.includes(label));
