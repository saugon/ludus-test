import { describe, expect, it } from 'vitest';
import { product } from '../test/fakes';
import { categoryTree, filterProducts } from './search';

describe('categoryTree', () => {
  const products = ['Terreno', 'Pinturas', 'Dados', 'Libros y Códex', 'Miniaturas', 'Pinturas'].map((category, index) =>
    product({ code: `P${index}`, category }),
  );
  const names = (tree: ReturnType<typeof categoryTree>) => tree.map((node) => node.name);

  it('follows the configured order, ignoring case and accents, and puts the rest at the end alphabetically', () => {
    expect(names(categoryTree(products, null, ['Miniaturas', 'Pinturas', 'Libros y codex']))).toEqual(['Miniaturas', 'Pinturas', 'Libros y Códex', 'Dados', 'Terreno']);
  });

  it('is alphabetical without an order', () => {
    expect(names(categoryTree(products, null, []))).toEqual(['Dados', 'Libros y Códex', 'Miniaturas', 'Pinturas', 'Terreno']);
  });

  it('builds the subcategories and their counts from the products when the API does not list them', () => {
    const catalog = [
      product({ code: 'A', category: 'Miniaturas', subcategory: 'Orks' }),
      product({ code: 'B', category: 'Miniaturas', subcategory: 'Necrons' }),
      product({ code: 'C', category: 'Miniaturas', subcategory: 'Orks' }),
      product({ code: 'D', category: 'Miniaturas' }),
      product({ code: 'E', category: null }),
    ];
    expect(categoryTree(catalog, null, [])).toEqual([
      {
        name: 'Miniaturas',
        count: 4,
        subcategories: [
          { name: 'Necrons', count: 1 },
          { name: 'Orks', count: 2 },
        ],
      },
    ]);
  });

  it("takes the API's categories, in the store's order", () => {
    const listed = [
      { name: 'Pinturas', product_count: 3, subcategories: [] },
      { name: 'Miniaturas', product_count: 5, subcategories: [{ name: 'Orks', product_count: 2 }] },
    ];
    expect(categoryTree([], listed, ['Miniaturas', 'Pinturas'])).toEqual([
      { name: 'Miniaturas', count: 5, subcategories: [{ name: 'Orks', count: 2 }] },
      { name: 'Pinturas', count: 3, subcategories: [] },
    ]);
  });
});

describe('filterProducts', () => {
  const catalog = [
    product({ code: 'A', name: 'Boyz', category: 'Miniaturas', subcategory: 'Orks' }),
    product({ code: 'B', name: 'Warriors', category: 'Miniaturas', subcategory: 'Necrons' }),
    product({ code: 'C', name: 'Pincel', category: 'Herramientas' }),
  ];
  const codes = (list: ReturnType<typeof filterProducts>) => list.map((entry) => entry.code);

  it('filters by subcategory within its main category', () => {
    expect(codes(filterProducts(catalog, { category: 'Miniaturas' }))).toEqual(['A', 'B']);
    expect(codes(filterProducts(catalog, { category: 'Miniaturas', subcategory: 'Orks' }))).toEqual(['A']);
  });

  it('finds a product by its subcategory', () => {
    expect(codes(filterProducts(catalog, { query: 'necrons' }))).toEqual(['B']);
  });
});
