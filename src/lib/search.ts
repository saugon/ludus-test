import type { Category, Product } from '@vertex/storefront-sdk';
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
  {
    query = '',
    category = '',
    subcategory = '',
    stock = 'todos',
  }: { query?: string; category?: string; subcategory?: string; stock?: StockFilter },
): Product[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);

  return products.filter((product) => {
    if (category && product.category !== category) return false;
    if (subcategory && product.subcategory !== subcategory) return false;
    if (stock === 'disponible' && !isOrderable(product)) return false;
    if (stock === 'encargo' && isOrderable(product)) return false;
    if (words.length === 0) return true;
    const haystack = normalize([product.name, product.category, product.subcategory, product.description, product.code].filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

export type CategoryNode = { name: string; count: number; subcategories: { name: string; count: number }[] };

// Las categorías principales con sus subcategorías y cuántos productos tiene cada una. Salen de la API cuando
// la hay; si no, de los productos cargados. Las principales van en el orden de la tienda (`store.categoryOrder`),
// las que no están en él al final por nombre; las subcategorías, por nombre.
export function categoryTree(products: Product[], categories: Category[] | null, order: readonly string[] = store.categoryOrder): CategoryNode[] {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');
  const tree = categories
    ? categories.map(({ name, product_count, subcategories }) => ({
        name,
        count: product_count,
        subcategories: subcategories.map((sub) => ({ name: sub.name, count: sub.product_count })).sort(byName),
      }))
    : fromProducts(products, byName);
  const rank = new Map(order.map((name, index) => [normalize(name), index]));
  const position = (name: string) => rank.get(normalize(name)) ?? Infinity;
  return tree.sort((a, b) => position(a.name) - position(b.name) || byName(a, b));
}

function fromProducts(products: Product[], byName: (a: { name: string }, b: { name: string }) => number): CategoryNode[] {
  const nodes = new Map<string, { count: number; subcategories: Map<string, number> }>();
  for (const { category, subcategory } of products) {
    if (!category) continue;
    const node = nodes.get(category) ?? { count: 0, subcategories: new Map() };
    node.count += 1;
    if (subcategory) node.subcategories.set(subcategory, (node.subcategories.get(subcategory) ?? 0) + 1);
    nodes.set(category, node);
  }
  return [...nodes].map(([name, node]) => ({
    name,
    count: node.count,
    subcategories: [...node.subcategories].map(([sub, count]) => ({ name: sub, count })).sort(byName),
  }));
}
