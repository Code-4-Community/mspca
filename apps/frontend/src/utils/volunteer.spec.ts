import { getAvatarColor, getInitials, parseVolunteerId } from './volunteer';

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
  it('maps volunteer IDs onto the palette in order', () => {
    expect(getAvatarColor(0)).toBe('purple.avatar');
    expect(getAvatarColor(1)).toBe('blue.blue2');
  });

  it('wraps around the palette', () => {
    expect(getAvatarColor(6)).toBe('purple.avatar');
  });

  it('is stable for the same volunteer', () => {
    expect(getAvatarColor(42)).toBe(getAvatarColor(42));
  });
});

describe('parseVolunteerId', () => {
  it('parses a positive integer', () => {
    expect(parseVolunteerId('12')).toBe(12);
  });

  it.each([null, '', 'abc', '0', '-3', '1.5', '12abc'])(
    'returns null for %j',
    (raw) => {
      expect(parseVolunteerId(raw)).toBeNull();
    },
  );
});
