import type { Cart } from '@vertex/storefront-sdk';
import { describe, expect, it } from 'vitest';
import { cart } from '../test/fakes';
import { discountedPrice, percentText } from './methods';

describe('percentText', () => {
  it('writes the percent the API sends as a decimal, the Argentine way', () => {
    expect(percentText('10.00')).toBe('10%');
    expect(percentText('12.50')).toBe('12,5%');
  });
});

describe('discountedPrice', () => {
  const priced = cart([{ code: 'CP-ORK', quantity: 2, price: 50000 }], 'cart-1', { openpay: null, transfer: 10 });

  it("gives the cart's price with the method only when it takes something off", () => {
    expect(discountedPrice(priced, 'transfer')).toEqual({ method: 'transfer', discount_percent: '10.00', discount: '10000.00', total: '90000.00', discount_code_amount: '0.00', discount_code_status: null });
    expect(discountedPrice(priced, 'openpay')).toBeNull();
    expect(discountedPrice(priced, 'cash')).toBeNull();
    expect(discountedPrice(priced, null)).toBeNull();
  });

  it('is null for a cart from a backend without payment method discounts', () => {
    const { payment_methods: _, ...legacy } = priced;
    expect(discountedPrice(legacy as Cart, 'transfer')).toBeNull();
  });
});
