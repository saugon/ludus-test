import type { Cart, CartLineInput } from '@vertex/storefront-sdk';

export const MAX_LINE_QUANTITY = 99;

export function clampQuantity(quantity: number, max: number): number {
  const limit = Math.min(Math.max(max, 0), MAX_LINE_QUANTITY);
  if (!Number.isFinite(quantity)) return 0;
  return Math.min(Math.max(Math.trunc(quantity), 0), limit);
}

export function linesOf(cart: Cart | null): CartLineInput[] {
  if (!cart) return [];
  return cart.lines.flatMap((line) => (line.code ? [{ code: line.code, quantity: line.quantity }] : []));
}

export function withQuantity(lines: CartLineInput[], code: string, quantity: number): CartLineInput[] {
  const others = lines.filter((line) => line.code !== code);
  if (quantity <= 0) return others;
  const index = lines.findIndex((line) => line.code === code);
  const next = { code, quantity };
  if (index === -1) return [...others, next];
  return [...others.slice(0, index), next, ...others.slice(index)];
}

export function quantityIn(cart: Cart | null, code: string): number {
  return cart?.lines.find((line) => line.code === code)?.quantity ?? 0;
}

export function itemCount(cart: Cart | null): number {
  return cart?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0;
}
