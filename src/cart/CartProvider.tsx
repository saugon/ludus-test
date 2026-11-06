import { StorefrontError, type Cart, type CartLineInput } from '@vertex/storefront-sdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ShortLine } from '../lib/errors';
import { useStorefront } from '../lib/storefront';
import { clampQuantity, itemCount, linesOf, quantityIn, withQuantity } from './lines';

type Status = 'loading' | 'ready' | 'error';

export type CartValue = {
  status: Status;
  cart: Cart | null;
  // Unidades en el carrito. Mientras carga, la última cantidad conocida, así el header no aparece vacío.
  count: number;
  saving: boolean;
  error: unknown;
  shortages: Map<string, number>;
  drawerOpen: boolean;
  add: (product: { code: string; max_quantity: number }, quantity?: number) => Promise<boolean>;
  setQuantity: (code: string, quantity: number) => Promise<boolean>;
  remove: (code: string) => Promise<boolean>;
  reportShortages: (lines: ShortLine[]) => void;
  fixShortages: () => Promise<boolean>;
  startNewCart: () => void;
  reload: () => Promise<void>;
  clearError: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartValue | null>(null);

export function cartStorageKey(venue: string): string {
  return `vertex-storefront:${venue}:cart`;
}

export function countStorageKey(venue: string): string {
  return `ludus:${venue}:cart-count`;
}

function readCount(venue: string): number {
  try {
    // Sin el token del SDK no hay carrito: no hay nada que recordar.
    if (!localStorage.getItem(cartStorageKey(venue))) return 0;
    const count = Number(localStorage.getItem(countStorageKey(venue)));
    return Number.isInteger(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

function writeCount(venue: string, count: number) {
  try {
    if (count > 0) localStorage.setItem(countStorageKey(venue), String(count));
    else localStorage.removeItem(countStorageKey(venue));
  } catch {
    // Sin localStorage el contador espera a la API, como antes.
  }
}

export function CartProvider({ venue, children }: { venue: string; children: ReactNode }) {
  const storefront = useStorefront();
  const [status, setStatus] = useState<Status>('loading');
  const [cart, setCart] = useState<Cart | null>(null);
  const [rememberedCount] = useState(() => readCount(venue));
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [shortages, setShortages] = useState<Map<string, number>>(() => new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cartRef = useRef<Cart | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);

  const commit = useCallback((next: Cart | null) => {
    cartRef.current = next;
    setCart(next);
    writeCount(venue, itemCount(next));
    setShortages((current) => {
      if (current.size === 0) return current;
      const still = new Map<string, number>();
      for (const [code, available] of current) {
        if (quantityIn(next, code) > available) still.set(code, available);
      }
      return still;
    });
  }, [venue]);

  const reload = useCallback(async () => {
    const current = ++generation.current;
    setStatus((status) => (status === 'ready' ? status : 'loading'));
    try {
      const loaded = await storefront.getCart();
      if (current !== generation.current) return;
      commit(loaded);
      setStatus('ready');
      setError(null);
    } catch (failure) {
      if (current !== generation.current) return;
      setError(failure);
      setStatus('error');
    }
  }, [storefront, commit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const write = useCallback(
    (compute: (lines: CartLineInput[]) => CartLineInput[]) => {
      setPending((count) => count + 1);
      const run = queue.current.then(async () => {
        try {
          const next = await storefront.setCartLines(compute(linesOf(cartRef.current)));
          generation.current += 1;
          commit(next);
          setStatus('ready');
          setError(null);
          return true;
        } catch (failure) {
          if (failure instanceof StorefrontError && failure.code === 'insufficient_stock') {
            setShortages(new Map(failure.lines.map((line) => [line.code, line.available])));
          }
          setError(failure);
          return false;
        } finally {
          setPending((count) => count - 1);
        }
      });
      queue.current = run;
      return run;
    },
    [storefront, commit],
  );

  const add = useCallback(
    (product: { code: string; max_quantity: number }, quantity = 1) =>
      write((lines) => {
        const current = lines.find((line) => line.code === product.code)?.quantity ?? 0;
        return withQuantity(lines, product.code, clampQuantity(current + quantity, product.max_quantity));
      }),
    [write],
  );

  const setQuantity = useCallback(
    (code: string, quantity: number) =>
      write((lines) => {
        const max = cartRef.current?.lines.find((line) => line.code === code)?.max_quantity ?? quantity;
        return withQuantity(lines, code, clampQuantity(quantity, max));
      }),
    [write],
  );

  const remove = useCallback((code: string) => write((lines) => withQuantity(lines, code, 0)), [write]);

  const reportShortages = useCallback((lines: ShortLine[]) => {
    setShortages(new Map(lines.map((line) => [line.code, line.available])));
  }, []);

  const fixShortages = useCallback(() => {
    const targets = new Map(shortages);
    return write((lines) =>
      lines.flatMap((line) => {
        const available = targets.get(line.code);
        if (available === undefined) return [line];
        return available > 0 ? [{ ...line, quantity: Math.min(line.quantity, available) }] : [];
      }),
    );
  }, [shortages, write]);

  const startNewCart = useCallback(() => {
    try {
      localStorage.removeItem(cartStorageKey(venue));
    } catch {
      // Without storage there is no saved token to forget.
    }
    commit(null);
    setError(null);
    setShortages(new Map());
  }, [venue, commit]);

  const clearError = useCallback(() => setError(null), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<CartValue>(
    () => ({
      status,
      cart,
      count: cart ? itemCount(cart) : status === 'loading' ? rememberedCount : 0,
      saving: pending > 0,
      error,
      shortages,
      drawerOpen,
      add,
      setQuantity,
      remove,
      reportShortages,
      fixShortages,
      startNewCart,
      reload,
      clearError,
      openDrawer,
      closeDrawer,
    }),
    [status, cart, rememberedCount, pending, error, shortages, drawerOpen, add, setQuantity, remove, reportShortages, fixShortages, startNewCart, reload, clearError, openDrawer, closeDrawer],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart needs a CartProvider');
  return value;
}
