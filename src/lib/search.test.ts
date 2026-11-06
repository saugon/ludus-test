import { describe, expect, it } from 'vitest';
import { product } from '../test/fakes';
import { categoriesOf } from './search';

describe('categoriesOf', () => {
  const products = ['Terreno', 'Pinturas', 'Dados', 'Libros y Códex', 'Miniaturas', 'Pinturas'].map((category, index) =>
    product({ code: `P${index}`, category }),
  );

  it('follows the configured order, ignoring case and accents, and puts the rest at the end alphabetically', () => {
    expect(categoriesOf(products, ['Miniaturas', 'Pinturas', 'Libros y codex'])).toEqual(['Miniaturas', 'Pinturas', 'Libros y Códex', 'Dados', 'Terreno']);
  });

  it('is alphabetical without an order', () => {
    expect(categoriesOf(products, [])).toEqual(['Dados', 'Libros y Códex', 'Miniaturas', 'Pinturas', 'Terreno']);
  });
});
