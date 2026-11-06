import { describe, expect, it } from 'vitest';
import { money } from './format';

describe('money', () => {
  it('drops the cents of a whole amount and keeps both digits otherwise', () => {
    expect(money('15650.00')).toMatch(/^\$\s15\.650$/);
    expect(money('4428.50')).toMatch(/^\$\s4\.428,50$/);
    expect(money('20078.5')).toMatch(/^\$\s20\.078,50$/);
    expect(money(null)).toBe('Consultar');
  });
});
