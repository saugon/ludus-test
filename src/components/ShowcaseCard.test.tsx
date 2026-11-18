import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cart, fakeStorefront, product } from '../test/fakes';
import { withStore } from '../test/render';
import { ShowcaseEncargoCard, ShowcaseProductCard } from './ShowcaseCard';

const wrapper = withStore(fakeStorefront());
const year = new Date().getFullYear();

describe('ShowcaseCard', () => {
  it('flags a presale product with its estimated date', () => {
    render(<ShowcaseProductCard product={product({ presale: true, presale_available_on: `${year}-12-15` })} />, { wrapper });
    expect(screen.getByText('Preventa, llegada estimada el 15 de diciembre')).toBeInTheDocument();
  });

  it('flags a presale product without a date', () => {
    render(<ShowcaseProductCard product={product({ presale: true })} />, { wrapper });
    expect(screen.getByText('Preventa', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.queryByText(/llegada estimada/)).not.toBeInTheDocument();
  });

  it('shows no tag for a regular product', () => {
    render(<ShowcaseProductCard product={product()} />, { wrapper });
    expect(screen.queryByText(/Preventa/)).not.toBeInTheDocument();
  });

  it('adds with a round + named after the product', () => {
    render(<ShowcaseProductCard product={product({ name: 'Combat Patrol: Orks' })} />, { wrapper });
    expect(screen.getByRole('button', { name: 'Agregar Combat Patrol: Orks al carrito' })).toBeInTheDocument();
  });

  it('shows presale on an encargo card, next to its "Por encargo" tag', () => {
    render(<ShowcaseEncargoCard product={product({ presale: true, presale_available_on: `${year + 1}-01-20` })} tagged />, { wrapper });
    expect(screen.getByText(`Preventa, llegada estimada el 20 de enero de ${year + 1}`)).toBeInTheDocument();
    expect(screen.getByText('Por encargo')).toBeInTheDocument();
  });
});

describe('the round + of a card', () => {
  it('shows how many are already in the cart', async () => {
    const storefront = fakeStorefront({ getCart: async () => cart([{ code: 'CP-ORK', quantity: 2 }]) });
    render(<ShowcaseProductCard product={product({ name: 'Combat Patrol: Orks', max_quantity: 5 })} />, { wrapper: withStore(storefront) });

    const add = await screen.findByRole('button', { name: 'Agregar otro Combat Patrol: Orks al carrito, ya tenés 2' });
    expect(add).toHaveTextContent('2');
  });
});
