import { formatAge } from './animals';

describe('formatAge', () => {
  it('shows years and months together', () => {
    expect(formatAge(2, 3)).toBe('2 yrs 3 mos');
  });

  it('uses singular units for 1', () => {
    expect(formatAge(1, 1)).toBe('1 yr 1 mo');
  });

  it('leaves out months when there are none', () => {
    expect(formatAge(4, 0)).toBe('4 yrs');
  });

  it('leaves out years when there are none', () => {
    expect(formatAge(0, 5)).toBe('5 mos');
  });
});
