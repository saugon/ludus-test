import type { Product, Storefront } from '@vertex/storefront-sdk';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const StorefrontContext = createContext<Storefront | null>(null);

export function StorefrontProvider({ storefront, children }: { storefront: Storefront; children: ReactNode }) {
  return <StorefrontContext.Provider value={storefront}>{children}</StorefrontContext.Provider>;
}

export function useStorefront(): Storefront {
  const storefront = useContext(StorefrontContext);
  if (!storefront) throw new Error('useStorefront needs a StorefrontProvider');
  return storefront;
}

type ProductsState =
  | { status: 'loading'; products: Product[]; error: null }
  | { status: 'ready'; products: Product[]; error: null }
  | { status: 'error'; products: Product[]; error: unknown };

type ProductsValue = ProductsState & { reload: () => void; byCode: Map<string, Product> };

const ProductsContext = createContext<ProductsValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const storefront = useStorefront();
  const [state, setState] = useState<ProductsState>({ status: 'loading', products: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((previous) => ({ status: 'loading', products: previous.products, error: null }));
    storefront.listProducts().then(
      (products) => active && setState({ status: 'ready', products, error: null }),
      (error: unknown) => active && setState((previous) => ({ status: 'error', products: previous.products, error })),
    );
    return () => {
      active = false;
    };
  }, [storefront, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const byCode = useMemo(() => new Map(state.products.map((product) => [product.code, product])), [state.products]);
  const value = useMemo(() => ({ ...state, reload, byCode }), [state, reload, byCode]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts(): ProductsValue {
  const value = useContext(ProductsContext);
  if (!value) throw new Error('useProducts needs a ProductsProvider');
  return value;
}

export function isOrderable(product: Pick<Product, 'status' | 'max_quantity'>): boolean {
  return product.status === 'available' && product.max_quantity > 0;
}
