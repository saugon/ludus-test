import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cartStorageKey, countStorageKey } from '../cart/CartProvider';
import { profileStorageKey } from '../shopper/ShopperProvider';
import { cart, fakeStorefront, sdkError, shopper } from '../test/fakes';
import { renderStore, VENUE } from '../test/render';

const never = () => new Promise<never>(() => {});

describe('the header while the page loads', () => {
  it('shows the remembered account, not «Ingresar», until the API answers', async () => {
    localStorage.setItem(profileStorageKey(VENUE), JSON.stringify(shopper()));
    const storefront = fakeStorefront({ shopper: { isSignedIn: () => true } });
    storefront.shopper.get.mockImplementation(never);
    renderStore(storefront, '/');

    expect(await screen.findByRole('link', { name: 'Mis pedidos, sesión de Ana' })).toHaveTextContent('A');
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  it('shows the account without a name when there is a session but nothing remembered', async () => {
    const storefront = fakeStorefront({ shopper: { isSignedIn: () => true } });
    storefront.shopper.get.mockImplementation(never);
    renderStore(storefront, '/');

    expect(await screen.findByRole('link', { name: 'Mis pedidos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  it('remembers the account once the API answers', async () => {
    renderStore(fakeStorefront({ shopper: { isSignedIn: () => true, get: async () => shopper({ name: 'Nico Paz', email: 'nico@example.com' }) } }), '/');

    await screen.findByRole('link', { name: 'Mis pedidos, sesión de Nico' });
    expect(JSON.parse(localStorage.getItem(profileStorageKey(VENUE))!)).toEqual({ name: 'Nico Paz', email: 'nico@example.com' });
  });

  it('switches to «Ingresar» and forgets the profile when the session expired', async () => {
    localStorage.setItem(profileStorageKey(VENUE), JSON.stringify(shopper()));
    renderStore(
      fakeStorefront({
        shopper: {
          isSignedIn: () => true,
          get: async () => {
            throw sdkError('shopper_unauthorized', 401);
          },
        },
      }),
      '/',
    );

    expect(await screen.findByRole('link', { name: 'Ingresar' })).toBeInTheDocument();
    expect(localStorage.getItem(profileStorageKey(VENUE))).toBeNull();
  });

  it('shows the remembered cart count until the cart loads, then the real one', async () => {
    localStorage.setItem(cartStorageKey(VENUE), 'cart-1');
    localStorage.setItem(countStorageKey(VENUE), '3');
    let answer: (value: ReturnType<typeof cart>) => void = () => {};
    const storefront = fakeStorefront({ getCart: () => new Promise((resolve) => (answer = resolve)) });
    renderStore(storefront, '/');

    expect(await screen.findByRole('button', { name: 'Abrir carrito, 3 productos' })).toBeInTheDocument();

    answer(cart([{ code: 'CP-ORK', quantity: 1 }]));
    expect(await screen.findByRole('button', { name: 'Abrir carrito, 1 producto' })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(countStorageKey(VENUE))).toBe('1'));
  });

  it('ignores a remembered count without a saved cart', async () => {
    localStorage.setItem(countStorageKey(VENUE), '3');
    const storefront = fakeStorefront();
    storefront.getCart.mockImplementation(never);
    renderStore(storefront, '/');

    expect(await screen.findByRole('button', { name: 'Abrir carrito, vacío' })).toBeInTheDocument();
  });
});
