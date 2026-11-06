import type { Storefront } from '@vertex/storefront-sdk';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Store } from '../App';
import { CartProvider } from '../cart/CartProvider';
import { ProductsProvider, StorefrontProvider } from '../lib/storefront';
import { ShopperProvider } from '../shopper/ShopperProvider';

export const VENUE = 'ludus-test';

export function renderStore(storefront: Storefront, path = '/', { homeDelivery = true }: { homeDelivery?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Store config={{ venue: VENUE, baseUrl: 'http://api.test', publishableKey: 'rst_pk_test', homeDelivery }} storefront={storefront} />
    </MemoryRouter>,
  );
}

export function withStore(storefront: Storefront) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <StorefrontProvider storefront={storefront}>
          <ProductsProvider>
            <ShopperProvider venue={VENUE}>
              <CartProvider venue={VENUE}>{children}</CartProvider>
            </ShopperProvider>
          </ProductsProvider>
        </StorefrontProvider>
      </MemoryRouter>
    );
  };
}
