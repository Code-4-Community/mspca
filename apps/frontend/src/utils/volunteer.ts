// Avatar background colors, picked by volunteer ID so each volunteer keeps the
// same color. Placeholder palette pending design confirmation.
export const AVATAR_COLORS: readonly string[] = [
  'purple.avatar',
  'blue.blue2',
  'teal.teal',
  'green.green2',
  'orange.orange3',
  'brown.brown',
];

const initial = (name: string): string => name.trim().charAt(0).toUpperCase();

export const getInitials = (firstName: string, lastName: string): string =>
  initial(firstName) + initial(lastName);

export const getAvatarColor = (volunteerId: number): string =>
  AVATAR_COLORS[volunteerId % AVATAR_COLORS.length];

/** Parses a volunteer ID from a URL value; anything but a positive integer is null. */
export const parseVolunteerId = (raw: string | null): number | null => {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
};
