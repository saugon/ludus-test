import { StorefrontError } from '@vertex/storefront-sdk';
import { describe, expect, it } from 'vitest';
import { sdkError } from '../test/fakes';
import { describeError } from './errors';

describe('describeError', () => {
  it('names how much is left of each short line on insufficient_stock', () => {
    const view = describeError(
      sdkError('insufficient_stock', 409, [
        { code: 'CP-ORK', requested: 3, available: 1 },
        { code: 'VAL-16', requested: 2, available: 0 },
      ]),
      { 'CP-ORK': 'Combat Patrol: Orks' },
    );

    expect(view.kind).toBe('stock');
    expect(view.title).toBe('No hay stock suficiente');
    expect(view.message).toBe('Combat Patrol: Orks: pediste 3 y quedan 1. VAL-16: se agotó.');
    expect(view.lines).toEqual([
      { code: 'CP-ORK', requested: 3, available: 1 },
      { code: 'VAL-16', requested: 2, available: 0 },
    ]);
    expect(view.retry).toBe(false);
  });

  it.each([
    ['validation_error', 'input', 'Revisá los datos', false],
    ['checkout_in_progress', 'busy', 'Ya hay un pago en curso', true],
    ['cart_closed', 'cart', 'Este carrito ya se cerró', false],
    ['provider_unavailable', 'payment', 'El pago no está disponible', true],
    ['service_unavailable', 'payment', 'El pago no está disponible', true],
    ['rate_limited', 'busy', 'Demasiados intentos seguidos', true],
    ['timeout', 'offline', 'Sin conexión', true],
    ['invalid_code', 'input', 'El código no sirve', false],
    ['too_many_attempts', 'busy', 'Demasiados intentos', false],
    ['shopper_unauthorized', 'session', 'Tu sesión venció', false],
    ['shipping_quote_expired', 'delivery', 'La cotización del envío venció', false],
  ] as const)('maps %s to a %s message', (code, kind, title, retry) => {
    const view = describeError(sdkError(code));

    expect(view).toMatchObject({ kind, title, retry });
    expect(view.message.length).toBeGreaterThan(10);
  });

  it('says an open checkout blocks changing the delivery too', () => {
    expect(describeError(sdkError('checkout_in_progress')).message).toContain('la forma de entrega');
  });

  it('explains quote errors in terms of the delivery, not the store setup', () => {
    const limited = describeError(sdkError('rate_limited', 429, [], 42), {}, 'quote');
    expect(limited.title).toBe('Demasiadas cotizaciones seguidas');
    expect(limited.message).toContain('Esperá 42 segundos');
    expect(describeError(sdkError('rate_limited', 429), {}, 'quote').message).toContain('Esperá un minuto');

    expect(describeError(sdkError('not_found', 404), {}, 'quote')).toMatchObject({ kind: 'delivery', title: 'Por ahora no hacemos envíos' });
    expect(describeError(sdkError('validation_error', 422), {}, 'quote').title).toBe('Revisá la dirección');
    expect(describeError(sdkError('timeout', null), {}, 'quote').title).toBe('Sin conexión');
  });

  it('mentions the phone and the DNI on a validation error of a checkout with delivery', () => {
    expect(describeError(sdkError('validation_error', 422), {}, 'delivery').message).toContain('el DNI');
  });

  it('tells what to check for configuration errors', () => {
    const unauthorized = describeError(sdkError('unauthorized', 401));
    expect(unauthorized.kind).toBe('config');
    expect(unauthorized.hint).toContain('VITE_STOREFRONT_KEY');
    expect(unauthorized.hint).toContain('read:catalog');

    const notFound = describeError(sdkError('not_found', 404));
    expect(notFound.kind).toBe('config');
    expect(notFound.hint).toContain('VITE_STOREFRONT_VENUE');
    expect(notFound.hint).toContain('VITE_STOREFRONT_BASE_URL');

    const invalidKey = describeError(new StorefrontError('invalid_key', 'A publishable key starts with rst_pk_'));
    expect(invalidKey.title).toBe('La clave de la tienda no es publicable');
    expect(invalidKey.message).toContain('rst_pk_');
    expect(invalidKey.hint).toContain('VITE_STOREFRONT_KEY');
  });

  it('falls back to a generic message for unknown codes and non-SDK errors', () => {
    expect(describeError(sdkError('internal_error', 500))).toMatchObject({ kind: 'unknown', retry: true });
    expect(describeError(new TypeError('boom'))).toMatchObject({ kind: 'unknown', title: 'Algo salió mal' });
  });
});
