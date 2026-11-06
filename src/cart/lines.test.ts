import { describe, expect, it } from 'vitest';
import { cart } from '../test/fakes';
import { clampQuantity, itemCount, linesOf, withQuantity } from './lines';

describe('cart lines', () => {
  it('clamps a quantity between 0 and the line maximum, never above 99', () => {
    expect(clampQuantity(5, 3)).toBe(3);
    expect(clampQuantity(-2, 3)).toBe(0);
    expect(clampQuantity(2.7, 3)).toBe(2);
    expect(clampQuantity(150, 120)).toBe(99);
    expect(clampQuantity(Number.NaN, 3)).toBe(0);
    expect(clampQuantity(4, 0)).toBe(0);
  });

  it('reads the writable lines of a cart, dropping lines without a code', () => {
    const current = cart([
      { code: 'A', quantity: 2 },
      { code: 'B', quantity: 1 },
    ]);
    current.lines.push({ ...current.lines[0], code: null });

    expect(linesOf(current)).toEqual([
      { code: 'A', quantity: 2 },
      { code: 'B', quantity: 1 },
    ]);
    expect(linesOf(null)).toEqual([]);
  });

  it('replaces a quantity in place, appends new codes and drops zeros', () => {
    const lines = [
      { code: 'A', quantity: 2 },
      { code: 'B', quantity: 1 },
    ];

    expect(withQuantity(lines, 'A', 3)).toEqual([
      { code: 'A', quantity: 3 },
      { code: 'B', quantity: 1 },
    ]);
    expect(withQuantity(lines, 'C', 1)).toEqual([...lines, { code: 'C', quantity: 1 }]);
    expect(withQuantity(lines, 'A', 0)).toEqual([{ code: 'B', quantity: 1 }]);
  });

  it('counts the units in the cart', () => {
    expect(itemCount(cart([{ code: 'A', quantity: 2 }, { code: 'B', quantity: 3 }]))).toBe(5);
    expect(itemCount(null)).toBe(0);
  });
});
