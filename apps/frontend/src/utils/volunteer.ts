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
