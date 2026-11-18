import type { Category, Product, Storefront } from '@vertex/storefront-sdk';
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

// `categories`: las categorías principales del local con sus subcategorías, como las lista la API. null mientras
// cargan o si el backend no tiene GET /categories (anterior a las subcategorías): ahí se arman con los productos.
type ProductsValue = ProductsState & { reload: () => void; byCode: Map<string, Product>; categories: Category[] | null };

// La API da el catálogo de a páginas de hasta 100: se piden todas, así la búsqueda y los filtros andan sin ir al servidor.
const PAGE_SIZE = 100;

async function listAllProducts(storefront: Storefront): Promise<Product[]> {
  const products: Product[] = [];
  let cursor: string | null = null;
  do {
    const page = await storefront.listProductsPage({ limit: PAGE_SIZE, cursor });
    products.push(...page.products);
    cursor = page.nextCursor;
  } while (cursor);
  return products;
}

const ProductsContext = createContext<ProductsValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const storefront = useStorefront();
  const [state, setState] = useState<ProductsState>({ status: 'loading', products: [], error: null });
  const [attempt, setAttempt] = useState(0);
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    let active = true;
    setState((previous) => ({ status: 'loading', products: previous.products, error: null }));
    listAllProducts(storefront).then(
      (products) => active && setState({ status: 'ready', products, error: null }),
      (error: unknown) => active && setState((previous) => ({ status: 'error', products: previous.products, error })),
    );
    return () => {
      active = false;
    };
  }, [storefront, attempt]);

  useEffect(() => {
    let active = true;
    storefront.listCategories().then(
      (list) => active && setCategories(list),
      // Sin la lista, el catálogo funciona igual con las categorías de los productos.
      () => active && setCategories(null),
    );
    return () => {
      active = false;
    };
  }, [storefront, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const byCode = useMemo(() => new Map(state.products.map((product) => [product.code, product])), [state.products]);
  const value = useMemo(() => ({ ...state, reload, byCode, categories }), [state, reload, byCode, categories]);

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
