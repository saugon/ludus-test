import { StorefrontError, type Cart, type CartDiscountCode, type CartPaymentMethod } from '@vertex/storefront-sdk';

// Los códigos de descuento del local. Un código se aplica al carrito (PUT /carts/:token/discount-code) y la API
// devuelve cuánto descuenta sobre los productos y, por cada medio de pago, cómo se combina con su descuento:
// `applied`, `outweighed` (el del medio es mayor y el código no suma nada) o `not_allowed` (Openpay no acepta
// códigos). El checkout lo vuelve a validar. Un backend sin códigos no manda estos campos: la tienda funciona igual.

// Por qué la API rechaza un código, al aplicarlo o al pagar.
const REASONS: Record<string, string> = {
  not_found: 'Ese código no existe. Revisá que esté bien escrito.',
  inactive: 'Ese código ya no está activo.',
  not_started: 'Ese código todavía no está vigente.',
  expired: 'Ese código venció.',
  exhausted: 'Ese código ya no tiene usos disponibles.',
  not_allowed_with_openpay: 'El código no se puede usar pagando con tarjeta o billetera virtual.',
};

export function discountCodeReason(reason: string): string {
  return REASONS[reason] ?? 'Ese código no se puede usar.';
}

// El motivo de un rechazo del código que vino en los `details` de un 422 («discount_code_expired» → «expired»).
export function discountCodeRefusal(error: unknown): string | null {
  if (!(error instanceof StorefrontError) || !Array.isArray(error.details)) return null;
  const detail = error.details.find((entry) => typeof entry?.code === 'string' && entry.code.startsWith('discount_code_'));
  return detail ? detail.code.slice('discount_code_'.length) : null;
}

// Lo que se muestra cuando falla aplicar o quitar un código.
export function discountCodeFailure(error: unknown): string {
  const refusal = discountCodeRefusal(error);
  if (refusal) return discountCodeReason(refusal);
  if (error instanceof StorefrontError) {
    switch (error.code) {
      case 'not_found':
        // La ruta responde 404 cuando el local no acepta códigos de descuento.
        return 'Por ahora la tienda no acepta códigos de descuento.';
      case 'validation_error':
        return 'Escribí un código válido.';
      case 'checkout_in_progress':
        return 'Este carrito tiene un pago en curso: no se puede cambiar el código hasta que termine o venza.';
      case 'cart_closed':
        return 'Este carrito ya se cerró. Empezá uno nuevo para seguir comprando.';
      case 'rate_limited':
        return 'Probaste muchos códigos seguidos. Esperá unos segundos y volvé a intentar.';
      case 'timeout':
        return 'No pudimos comunicarnos con la tienda. Revisá tu conexión y volvé a intentar.';
    }
  }
  return 'No pudimos aplicar el código. Probá de nuevo en un momento.';
}

// El código que tiene el carrito, o null (también con un backend sin códigos).
export function cartCode(cart: Cart | null | undefined): CartDiscountCode | null {
  return cart?.discount_code ?? null;
}

// Por qué el código del carrito dejó de valer (el checkout lo rechaza), o null si vale o no hay código.
export function cartCodeError(cart: Cart | null | undefined): string | null {
  return cart?.discount_code_error ?? null;
}

// Los productos con el código descontado, antes del medio de pago y del envío.
export function totalWithCode(cart: Cart | null | undefined): string | undefined {
  if (!cart) return undefined;
  return cartCode(cart) && !cartCodeError(cart) ? (cart.total_with_discount_code ?? cart.total) : cart.total;
}

// Si el medio no acepta el código que tiene el carrito: no se puede pagar con él mientras esté el código.
export function rejectsCode(priced: CartPaymentMethod | null | undefined): boolean {
  return priced?.discount_code_status === 'not_allowed';
}

