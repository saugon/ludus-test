import type { Product } from '@vertex/storefront-sdk';
import { store } from '../content';
import { isOrderable } from './storefront';

export type StockFilter = 'todos' | 'disponible' | 'encargo';

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function filterProducts(
  products: Product[],
  { query = '', category = '', stock = 'todos' }: { query?: string; category?: string; stock?: StockFilter },
): Product[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);

  return products.filter((product) => {
    if (category && product.category !== category) return false;
    if (stock === 'disponible' && !isOrderable(product)) return false;
    if (stock === 'encargo' && isOrderable(product)) return false;
    if (words.length === 0) return true;
    const haystack = normalize([product.name, product.category, product.description, product.code].filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

export function categoriesOf(products: Product[], order: readonly string[] = store.categoryOrder): string[] {
  const rank = new Map(order.map((name, index) => [normalize(name), index]));
  const position = (name: string) => rank.get(normalize(name)) ?? Infinity;
  return [...new Set(products.flatMap((product) => (product.category ? [product.category] : [])))].sort(
    (a, b) => position(a) - position(b) || a.localeCompare(b, 'es'),
  );
}
