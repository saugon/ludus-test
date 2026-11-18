import { describe, expect, it } from 'vitest';
import { describeOrder, holdDeadline } from './orderStatus';

describe('holdDeadline', () => {
  it('says the time, and the day when it is not today, in Buenos Aires time', () => {
    const now = new Date('2026-11-12T15:00:00Z');
    expect(holdDeadline('2026-11-12T21:30:00Z', now)).toBe('las 18:30 de hoy');
    expect(holdDeadline('2026-11-13T04:30:00Z', now)).toBe('las 01:30 del 13 nov');
    expect(holdDeadline('no es una fecha', now)).toBe('');
  });
});

describe('describeOrder', () => {
  const awaiting = { status: 'awaiting_payment', fulfillment_status: null } as const;

  it('tells an order awaiting its transfer or cash from one awaiting Openpay or Mercado Pago', () => {
    expect(describeOrder({ ...awaiting, payment_method: 'transfer' }, 'Olleros 3162').label).toBe('Esperando la transferencia');
    expect(describeOrder({ ...awaiting, payment_method: 'cash' }, 'Olleros 3162').label).toBe('A pagar al retirar');
    expect(describeOrder({ ...awaiting, payment_method: 'openpay' }, 'Olleros 3162').label).toBe('Pago pendiente');
    expect(describeOrder({ ...awaiting, payment_method: 'mercadopago' }, 'Olleros 3162').label).toBe('Pago pendiente');
    // Un backend sin pagos offline no manda payment_method: es Openpay.
    expect(describeOrder(awaiting, 'Olleros 3162').label).toBe('Pago pendiente');
  });
});
