import { describe, expect, it } from 'vitest';
import { describeOrder, orderDate, paymentLabel, pickupLabel } from './orderStatus';
import { safeReturnPath, signInPath } from './returnPath';

describe('safeReturnPath', () => {
  it.each([
    ['/checkout', '/checkout'],
    ['/productos?q=orks', '/productos?q=orks'],
    [null, '/cuenta'],
    ['', '/cuenta'],
    ['https://evil.example.com', '/cuenta'],
    ['//evil.example.com', '/cuenta'],
    ['/\\evil.example.com', '/cuenta'],
    ['/ingresar', '/cuenta'],
    ['/ingresar?volver=/checkout', '/cuenta'],
  ])('sends %s to %s', (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });

  it('builds the sign-in link that comes back to a page', () => {
    expect(signInPath('/checkout')).toBe('/ingresar?volver=%2Fcheckout');
    expect(safeReturnPath(new URLSearchParams(signInPath('/checkout').split('?')[1]).get('volver'))).toBe('/checkout');
  });
});

describe('describeOrder', () => {
  const address = 'Olleros 3162';

  it.each([
    ['paid', 'pending', 'En preparación', 'progress'],
    ['paid', null, 'En preparación', 'progress'],
    ['paid', 'ready', 'Listo para retirar', 'ready'],
    ['paid', 'picked_up', 'Retirado', 'done'],
    ['paid', 'shipped', 'En camino', 'progress'],
    ['paid', 'delivered', 'Entregado', 'done'],
    ['paid', 'cancelled', 'Cancelado', 'problem'],
    ['attention', null, 'Pago en revisión', 'problem'],
    ['failed', null, 'Pago no completado', 'problem'],
    ['approved', null, 'Confirmando el pago', 'progress'],
    ['awaiting_payment', null, 'Pago pendiente', 'progress'],
    ['creating_order', null, 'Pago pendiente', 'progress'],
  ] as const)('shows a %s order with pickup %s as %s', (status, fulfillment, label, tone) => {
    expect(describeOrder({ status, fulfillment_status: fulfillment }, address)).toMatchObject({ label, tone });
  });

  it('tells where to pick up a ready order', () => {
    expect(describeOrder({ status: 'paid', fulfillment_status: 'ready' }, address).hint).toContain('Olleros 3162');
  });

  it('does not ask to pick up an order that ships home', () => {
    for (const fulfillment of ['shipped', 'delivered'] as const) {
      expect(describeOrder({ status: 'paid', fulfillment_status: fulfillment }, address).hint).not.toMatch(/retir/i);
    }
  });

  it.each([
    [null, 'En preparación'],
    ['pending', 'En preparación'],
    ['ready', 'Listo para despachar'],
    ['shipped', 'En camino'],
    ['delivered', 'Entregado'],
  ] as const)('shows a paid order shipped home with %s as %s, without asking to pick it up', (fulfillment, label) => {
    const view = describeOrder({ status: 'paid', fulfillment_status: fulfillment, delivery: { kind: 'carrier' } }, address);
    expect(view.label).toBe(label);
    expect(view.hint).not.toMatch(/retir|Olleros/i);
  });

  it('names the payment and the pickup on their own', () => {
    expect(paymentLabel('paid')).toBe('Pagado');
    expect(pickupLabel('ready')).toBe('Listo para retirar');
    expect(pickupLabel('shipped')).toBe('Despachado');
    expect(pickupLabel('delivered')).toBe('Entregado');
    expect(pickupLabel(null)).toBeNull();
  });
});

describe('orderDate', () => {
  it('shows the time in Buenos Aires', () => {
    expect(orderDate('2026-11-04T21:30:00Z')).toBe('4 nov 2026, 18:30');
  });

  it('leaves an unreadable date empty', () => {
    expect(orderDate('no es una fecha')).toBe('');
  });
});
