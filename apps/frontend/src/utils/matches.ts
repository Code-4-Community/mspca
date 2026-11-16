import { MatchStatus, type Animal, type Match } from '../types';

export interface MatchWithAnimal {
  match: Match;
  animal: Animal;
}

export interface GroupedMatches {
  pending: MatchWithAnimal[];
  current: MatchWithAnimal[];
  past: MatchWithAnimal[];
}

/**
 * Pairs each match with its animal (matches only carry the Chameleon ID) and
 * sorts them into the Volunteer Profile dashboard sections:
 * Pending -> Pending Applications, Active -> Current Fosters,
 * Complete -> Past Fosters. Denied, withdrawn and canceled matches aren't
 * shown on the dashboard. Matches whose animal isn't in `animals` are skipped.
 */
export const groupMatches = (
  matches: Match[],
  animals: Animal[],
): GroupedMatches => {
  const animalsById = new Map(
    animals.map((animal) => [animal.chameleonAnimalId, animal]),
  );
  const groups: GroupedMatches = { pending: [], current: [], past: [] };

  for (const match of matches) {
    const animal = animalsById.get(match.chameleonAnimalId);
    if (!animal) continue;

    if (match.status === MatchStatus.PENDING) {
      groups.pending.push({ match, animal });
    } else if (match.status === MatchStatus.ACTIVE) {
      groups.current.push({ match, animal });
    } else if (match.status === MatchStatus.COMPLETE) {
      groups.past.push({ match, animal });
    }
  }

  return groups;
};
