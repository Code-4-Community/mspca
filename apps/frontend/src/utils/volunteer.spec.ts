import { colors } from '../theme';
import {
  AVATAR_COLORS,
  getAvatarColor,
  getInitials,
  parseVolunteerId,
} from './volunteer';

describe('getInitials', () => {
  it('uses the first letter of each name', () => {
    expect(getInitials('Matt', 'Wong')).toBe('MW');
  });

  it('trims whitespace and uppercases', () => {
    expect(getInitials(' anna ', 'lee')).toBe('AL');
  });

  it('returns an empty string when both names are empty', () => {
    expect(getInitials('', '')).toBe('');
  });

  it('returns a single initial when the last name is empty', () => {
    expect(getInitials('Cher', '')).toBe('C');
  });
});

describe('getAvatarColor', () => {
  it('uses the Trello label colors in theme order', () => {
    expect(getAvatarColor(0)).toBe('trello.noRestrictions');
    expect(getAvatarColor(1)).toBe('trello.dogFreeHome');
  });

  it('wraps around the palette', () => {
    expect(getAvatarColor(7)).toBe('trello.noRestrictions');
  });

  it('includes every Trello label color', () => {
    expect(AVATAR_COLORS).toEqual(
      Object.keys(colors.trello).map((key) => `trello.${key}`),
    );
  });

  it('is stable for the same volunteer', () => {
    expect(getAvatarColor(42)).toBe(getAvatarColor(42));
  });
});

describe('parseVolunteerId', () => {
  it('parses a positive integer', () => {
    expect(parseVolunteerId('12')).toBe(12);
  });

  it.each([
    null,
    '',
    'abc',
    '0',
    '-3',
    '1.5',
    '12abc',
    '99999999999999999999999',
  ])('returns null for %j', (raw) => {
    expect(parseVolunteerId(raw)).toBeNull();
  });
});
