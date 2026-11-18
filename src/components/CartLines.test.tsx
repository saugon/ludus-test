import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cart, fakeStorefront, product } from '../test/fakes';
import { withStore } from '../test/render';
import { CartLines } from './CartLines';

describe('CartLines', () => {
  it('flags the lines of products on presale, from the catalog', async () => {
    const year = new Date().getFullYear();
    const storefront = fakeStorefront({
      getCart: async () => cart([{ code: 'WS', quantity: 2 }, { code: 'ALI', quantity: 1 }]),
      products: [product({ code: 'WS', presale: true, presale_available_on: `${year}-12-25` }), product({ code: 'ALI' })],
    });
    render(<CartLines />, { wrapper: withStore(storefront) });

    expect(await screen.findByText('Preventa · llegada estimada el 25 de diciembre')).toBeInTheDocument();
    expect(screen.getAllByText(/^Preventa/)).toHaveLength(1);
  });
});
