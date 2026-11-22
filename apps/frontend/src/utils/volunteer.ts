import { useSearchParams } from 'react-router-dom';

import { colors } from '../theme';

// Avatars reuse the Trello label colors, so changing those in theme.ts
// updates avatars too.
export const AVATAR_COLORS: readonly string[] = Object.keys(colors.trello).map(
  (key) => `trello.${key}`,
);

const initial = (name: string): string => name.trim().charAt(0).toUpperCase();

export const getInitials = (firstName: string, lastName: string): string =>
  initial(firstName) + initial(lastName);

export const getAvatarColor = (volunteerId: number): string =>
  AVATAR_COLORS[volunteerId % AVATAR_COLORS.length];

export const parseVolunteerId = (raw: string | null): number | null => {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
};

/**
 * The current volunteer's ID, read from the `?volunteerId=` query param.
 * TEMPORARY: replace with the signed-in volunteer once sign-in is implemented.
 */
export const useVolunteerId = (): number | null => {
  const [searchParams] = useSearchParams();
  return parseVolunteerId(searchParams.get('volunteerId'));
};
