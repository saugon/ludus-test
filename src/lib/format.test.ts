import { describe, expect, it } from 'vitest';
import { money, shortDate } from './format';

describe('money', () => {
  it('drops the cents of a whole amount and keeps both digits otherwise', () => {
    expect(money('15650.00')).toMatch(/^\$\s15\.650$/);
    expect(money('4428.50')).toMatch(/^\$\s4\.428,50$/);
    expect(money('20078.5')).toMatch(/^\$\s20\.078,50$/);
    expect(money(null)).toBe('Consultar');
  });
});

describe('shortDate', () => {
  const today = new Date(2026, 10, 11);

  it('formats an API date without letting the time zone move it a day', () => {
    expect(shortDate('2026-12-01', { today })).toBe('1 dic');
    expect(shortDate('2026-12-01', { today, long: true })).toBe('1 de diciembre');
  });

  it('adds the year when it is not the current one', () => {
    expect(shortDate('2027-01-20', { today })).toBe('20 ene 2027');
    expect(shortDate('2027-01-20', { today, long: true })).toBe('20 de enero de 2027');
  });

  it('returns null for something that is not a date', () => {
    expect(shortDate('pronto', { today })).toBeNull();
  });
});
