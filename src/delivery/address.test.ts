import { describe, expect, it } from 'vitest';
import { PROVINCES, addAmounts, formatAddress, postalCode, toDeliveryAddress, validateContact, type AddressForm } from './address';

const form: AddressForm = { street: ' Olleros ', number: '3162', floor: '', apartment: '', postal_code: 'C1426CRL', city: 'CABA', province: 'CABA' };

describe('delivery address', () => {
  it('lists the 24 jurisdictions, CABA first', () => {
    expect(PROVINCES).toHaveLength(24);
    expect(PROVINCES[0][0]).toBe('CABA');
  });

  it.each([
    ['1426', '1426'],
    ['C1426CRL', '1426'],
    [' 5000 ', '5000'],
    ['142', null],
    ['14260', null],
  ])('reads the postal code %s as %s', (input, expected) => {
    expect(postalCode(input)).toBe(expected);
  });

  it('builds the API address, leaving out the floor and apartment when empty', () => {
    expect(toDeliveryAddress(form)).toEqual({ street: 'Olleros', number: '3162', postal_code: '1426', city: 'CABA', province: 'CABA' });
    expect(toDeliveryAddress({ ...form, province: '' })).toBeNull();
  });

  it('writes the address the way the store says it', () => {
    expect(formatAddress({ street: 'San Martín', number: '50', floor: '2', apartment: 'A', postal_code: '5000', city: 'Córdoba', province: 'Córdoba' })).toBe(
      'San Martín 50, piso 2, depto A, Córdoba (CP 5000)',
    );
    expect(formatAddress({ street: 'Mitre', number: '10', postal_code: '1900', city: 'La Plata', province: 'Buenos Aires' })).toBe(
      'Mitre 10, La Plata, Buenos Aires (CP 1900)',
    );
  });
});

describe('validateContact', () => {
  it('takes a phone of 8 to 15 digits and a DNI of 7 or 8, with dots', () => {
    expect(validateContact({ phone: '+54 (11) 2345-6789', document: '30.123.456' })).toEqual({});
    expect(validateContact({ phone: '1234567', document: '123456' })).toEqual({
      phone: expect.stringContaining('teléfono'),
      document: 'Escribí tu DNI, de 7 u 8 números.',
    });
  });
});

describe('addAmounts', () => {
  it('adds two API amounts to cents', () => {
    expect(addAmounts('285000.00', '8500.50')).toBe('293500.50');
    expect(addAmounts(null, '1.00')).toBeNull();
  });
});
