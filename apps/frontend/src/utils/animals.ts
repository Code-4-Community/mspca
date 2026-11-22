import { FosterType, Homebase, Restriction, type Animal } from '../types';

export interface RestrictionOption {
  label: Restriction;
  color: string;
}

export const RESTRICTIONS: Record<Restriction, RestrictionOption> = {
  [Restriction.NO_RESTRICTIONS]: {
    label: Restriction.NO_RESTRICTIONS,
    color: 'trello.noRestrictions',
  },
  [Restriction.DOG_FREE_HOME]: {
    label: Restriction.DOG_FREE_HOME,
    color: 'trello.dogFreeHome',
  },
  [Restriction.CAT_FREE_HOME]: {
    label: Restriction.CAT_FREE_HOME,
    color: 'trello.catFreeHome',
  },
  [Restriction.ACTIVITY_RESTRICTION]: {
    label: Restriction.ACTIVITY_RESTRICTION,
    color: 'trello.activityRestriction',
  },
  [Restriction.CHILD_FREE_HOME]: {
    label: Restriction.CHILD_FREE_HOME,
    color: 'trello.childFreeHome',
  },
  [Restriction.PET_FREE_HOME]: {
    label: Restriction.PET_FREE_HOME,
    color: 'trello.petFreeHome',
  },
  [Restriction.REQUIRES_MEDICATION]: {
    label: Restriction.REQUIRES_MEDICATION,
    color: 'trello.requiresMedication',
  },
};

export const formatAge = (ageYear: number, ageMonth: number): string => {
  const parts: string[] = [];
  if (ageYear > 0) parts.push(`${ageYear} ${ageYear === 1 ? 'yr' : 'yrs'}`);
  if (ageMonth > 0) {
    parts.push(`${ageMonth} ${ageMonth === 1 ? 'mo' : 'mos'}`);
  }
  return parts.join(' ');
};

// Exact address of each homebase, shown wherever an animal's location is.
export const HOMEBASE_ADDRESSES: Record<Homebase, string> = {
  [Homebase.BOSTON]: '350 South Huntington Ave, Boston, MA',
  [Homebase.CAPE_COD]: '1577 Falmouth Rd, Centerville, MA',
  [Homebase.SALEM]: '347 Highland Ave, Salem, MA',
  [Homebase.NEVINS_FARM]: '400 Broadway, Methuen, MA',
};

export const HOMEBASE_LABELS: Record<Homebase, string> = {
  [Homebase.BOSTON]: 'Boston',
  [Homebase.CAPE_COD]: 'Cape Cod',
  [Homebase.NEVINS_FARM]: 'Methuen and Nevins Farm',
  [Homebase.SALEM]: 'Northeast Animal Shelter',
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
