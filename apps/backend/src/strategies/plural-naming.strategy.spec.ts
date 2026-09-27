import { PluralNamingStrategy } from './plural-naming.strategy';

describe('PluralNamingStrategy', () => {
  const strategy = new PluralNamingStrategy();

  describe('columnName', () => {
    it('uses the name given in @Column', () => {
      expect(strategy.columnName('volunteerId', 'volunteer_id')).toBe(
        'volunteer_id',
      );
    });

    it('falls back to the property name', () => {
      expect(strategy.columnName('phone', '')).toBe('phone');
    });
  });
});
