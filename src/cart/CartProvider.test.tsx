import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cart, fakeStorefront, product, sdkError } from '../test/fakes';
import { VENUE, withStore } from '../test/render';
import { cartStorageKey, useCart } from './CartProvider';

function setup(storefront = fakeStorefront()) {
  const hook = renderHook(() => useCart(), { wrapper: withStore(storefront) });
  return { storefront, ...hook };
}

describe('CartProvider', () => {
  it('restores the saved cart on load', async () => {
    const saved = cart([{ code: 'CP-ORK', quantity: 2 }]);
    const { result, storefront } = setup(fakeStorefront({ getCart: async () => saved }));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.cart).toEqual(saved);
    expect(storefront.getCart).toHaveBeenCalled();
  });

  it('adds to the existing lines, sending every line, and clamps to max_quantity', async () => {
    const { result, storefront } = setup(
      fakeStorefront({ getCart: async () => cart([{ code: 'VAL-16', quantity: 1 }]) }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(() => result.current.add(product({ code: 'CP-ORK', max_quantity: 3 }), 2));
    expect(storefront.setCartLines).toHaveBeenLastCalledWith([
      { code: 'VAL-16', quantity: 1 },
      { code: 'CP-ORK', quantity: 2 },
    ]);

    await act(() => result.current.add(product({ code: 'CP-ORK', max_quantity: 3 }), 5));
    expect(storefront.setCartLines).toHaveBeenLastCalledWith([
      { code: 'VAL-16', quantity: 1 },
      { code: 'CP-ORK', quantity: 3 },
    ]);
    expect(result.current.cart?.lines.find((line) => line.code === 'CP-ORK')?.quantity).toBe(3);
  });

  it('edits a quantity within the line maximum and removes lines down to an empty cart', async () => {
    const { result, storefront } = setup(
      fakeStorefront({
        getCart: async () =>
          cart([
            { code: 'A', quantity: 1, max: 4 },
            { code: 'B', quantity: 2, max: 4 },
          ]),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(() => result.current.setQuantity('A', 9));
    expect(storefront.setCartLines).toHaveBeenLastCalledWith([
      { code: 'A', quantity: 4 },
      { code: 'B', quantity: 2 },
    ]);

    await act(() => result.current.remove('A'));
    expect(storefront.setCartLines).toHaveBeenLastCalledWith([{ code: 'B', quantity: 2 }]);

    await act(() => result.current.remove('B'));
    expect(storefront.setCartLines).toHaveBeenLastCalledWith([]);
    expect(result.current.cart?.lines).toEqual([]);
  });

  it('runs writes one after the other, so quick clicks build on each other', async () => {
    const calls: unknown[] = [];
    const storefront = fakeStorefront({
      setCartLines: async (lines) => {
        calls.push(lines);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return cart(lines.map((line) => ({ ...line })));
      },
    });
    const { result } = setup(storefront);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      const item = product({ code: 'CP-ORK', max_quantity: 5 });
      await Promise.all([result.current.add(item), result.current.add(item), result.current.add(item)]);
    });

    expect(calls).toEqual([
      [{ code: 'CP-ORK', quantity: 1 }],
      [{ code: 'CP-ORK', quantity: 2 }],
      [{ code: 'CP-ORK', quantity: 3 }],
    ]);
    expect(result.current.cart?.lines[0].quantity).toBe(3);
    expect(result.current.saving).toBe(false);
  });

  it('keeps the cart and exposes the error when a write fails', async () => {
    const saved = cart([{ code: 'A', quantity: 1 }]);
    const failure = sdkError('rate_limited', 429);
    const { result } = setup(
      fakeStorefront({
        getCart: async () => saved,
        setCartLines: async () => {
          throw failure;
        },
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setQuantity('A', 2);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe(failure);
    expect(result.current.cart).toEqual(saved);
  });

  it('marks short lines on insufficient_stock and fixes them to what is left', async () => {
    const { result, storefront } = setup(
      fakeStorefront({
        getCart: async () =>
          cart([
            { code: 'A', quantity: 3 },
            { code: 'B', quantity: 2 },
            { code: 'C', quantity: 1 },
          ]),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() =>
      result.current.reportShortages([
        { code: 'A', requested: 3, available: 1 },
        { code: 'B', requested: 2, available: 0 },
      ]),
    );
    expect([...result.current.shortages]).toEqual([
      ['A', 1],
      ['B', 0],
    ]);

    await act(() => result.current.fixShortages());
    expect(storefront.setCartLines).toHaveBeenLastCalledWith([
      { code: 'A', quantity: 1 },
      { code: 'C', quantity: 1 },
    ]);
    expect(result.current.shortages.size).toBe(0);
  });

  it('forgets a closed cart so the next add creates a new one', async () => {
    localStorage.setItem(cartStorageKey(VENUE), 'cart-closed');
    const { result } = setup(fakeStorefront({ getCart: async () => cart([{ code: 'A', quantity: 1 }], 'cart-closed') }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.startNewCart());

    expect(localStorage.getItem(cartStorageKey(VENUE))).toBeNull();
    expect(result.current.cart).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('keeps the newest load when an older getCart answers last', async () => {
    let answerFirst: (value: ReturnType<typeof cart>) => void = () => {};
    const storefront = fakeStorefront();
    storefront.getCart
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockImplementation(async () => null);
    const { result } = setup(storefront);

    await act(() => result.current.reload());
    expect(result.current.cart).toBeNull();

    await act(async () => answerFirst(cart([{ code: 'A', quantity: 1 }])));
    expect(result.current.cart).toBeNull();
    expect(result.current.status).toBe('ready');
  });

  it('does not let a load that started before a write overwrite it', async () => {
    let answerLoad: (value: ReturnType<typeof cart>) => void = () => {};
    const storefront = fakeStorefront();
    storefront.getCart.mockImplementationOnce(() => new Promise((resolve) => (answerLoad = resolve)));
    const { result } = setup(storefront);

    await act(() => result.current.add(product({ code: 'B', max_quantity: 5 })));
    await act(async () => answerLoad(cart([{ code: 'A', quantity: 1 }])));

    expect(result.current.cart?.lines.map((line) => line.code)).toEqual(['B']);
  });

  it('reports a load failure as an error state', async () => {
    const failure = sdkError('timeout', null);
    const { result } = setup(
      fakeStorefront({
        getCart: async () => {
          throw failure;
        },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(failure);
  });
});
