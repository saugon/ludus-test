import { paymentMethodTotal, StorefrontError, type Cart, type CartPaymentMethod, type Checkout, type CheckoutTransfer, type PaymentMethod, type PaymentMethodName } from '@vertex/storefront-sdk';
import { useCallback, useRef, useState } from 'react';
import type { Storefront } from '@vertex/storefront-sdk';

// Transferencia y efectivo no pasan por un proveedor: el pedido queda reservado y el local confirma el pago a mano.
// Si no lo confirma en las horas que fija el local (`hold_hours`, 24 si no lo cambió), el pedido se cancela y se
// libera el stock.

// Las horas que un pedido con este medio queda reservado, como las fija el local hoy. `null` con Openpay o Mercado Pago, o si
// todavía no se cargaron los medios o el local dejó de aceptar el medio.
export function holdHoursOf(methods: PaymentMethod[] | null | undefined, method: PaymentMethodName): number | null {
  return methods?.find((option) => option.method === method)?.hold_hours ?? null;
}

// «24 horas», «1 hora». Vacío si no se sabe: cada texto que lo usa tiene que leerse bien sin el plazo.
export function holdText(hours: number | null): string {
  if (hours == null || hours <= 0) return '';
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

export const PAYMENT_LABELS: Record<PaymentMethodName, string> = {
  openpay: 'Tarjeta o billetera virtual',
  mercadopago: 'Mercado Pago',
  transfer: 'Transferencia bancaria',
  cash: 'Efectivo al retirar',
};

// «10%», «12,5%»: el porcentaje que manda la API como decimal («10.00»).
export function percentText(percent: string): string {
  return `${Number(percent).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
}

// Lo que cuesta el carrito con el medio elegido, antes del envío, sólo si ese medio tiene descuento. Un backend sin
// descuentos por medio de pago no manda `payment_methods`: ahí el total es el del carrito, como siempre.
export function discountedPrice(cart: Cart | null | undefined, method: PaymentMethodName | null): CartPaymentMethod | null {
  if (!cart?.payment_methods || !method) return null;
  const priced = paymentMethodTotal(cart, method);
  return priced && Number(priced.discount) > 0 ? priced : null;
}

// Cómo se nombra el medio al lado de su descuento: «Descuento 10% · transferencia».
export const DISCOUNT_LABELS: Record<PaymentMethodName, string> = {
  openpay: 'tarjeta',
  mercadopago: 'Mercado Pago',
  transfer: 'transferencia',
  cash: 'efectivo',
};

export const ACCOUNT_LABELS: Record<CheckoutTransfer['account_type'], string> = {
  cbu: 'CBU',
  cvu: 'CVU',
  alias: 'Alias',
};

// Un backend sin pagos offline (Vertex antes de #4734) no manda `payment_method` en los checkouts ni en los
// pedidos, ni tiene GET /payment-methods: todo se paga con Openpay. Con esto la tienda funciona contra los dos.
export function paymentMethodOf(value: { payment_method?: PaymentMethodName | null }): PaymentMethodName {
  return value.payment_method ?? 'openpay';
}

// Openpay y Mercado Pago cobran online: llevan a quien compra a pagar en el proveedor y no piden cuenta.
export function paysOnline(method: PaymentMethodName): boolean {
  return method === 'openpay' || method === 'mercadopago';
}

export function paysOffline(value: { payment_method?: PaymentMethodName | null }): boolean {
  return !paysOnline(paymentMethodOf(value));
}

// Un pedido reservado que espera que el local confirme la transferencia o el efectivo.
export function awaitsOfflinePayment(checkout: Pick<Checkout, 'status' | 'payment_method'>): boolean {
  return checkout.status === 'awaiting_payment' && paysOffline(checkout);
}

// El checkout por transferencia o efectivo que ya hizo de este carrito un pedido, si hay uno: la tienda lo suelta y sigue con uno nuevo.
export function reservedCheckout(cart: { checkout: { status: Checkout['status']; payment_method: PaymentMethodName } | null } | null | undefined) {
  return cart?.checkout && awaitsOfflinePayment(cart.checkout) ? cart.checkout : null;
}

// Si el carrito ya es una compra hecha: pagada (o aprobada, mientras se arma la venta) o reservada por transferencia o
// efectivo. La API ya no deja cambiarlo (`cart_closed`), así que la tienda lo suelta y sigue con uno nuevo. El SDK
// olvida solo el pagado que ve /pedido; uno pagado por fuera (quien compra no volvió del proveedor) llega acá.
export function soldCart(cart: { checkout: { status: Checkout['status']; payment_method: PaymentMethodName } | null } | null | undefined): boolean {
  const status = cart?.checkout?.status;
  return status === 'paid' || status === 'approved' || reservedCheckout(cart) != null;
}

const OPENPAY_ONLY: PaymentMethod[] = [{ method: 'openpay', pickup_only: false, transfer: null, hold_hours: null, discount_percent: null }];

// Los medios que se pueden usar con la entrega elegida: el efectivo es sólo al retirar.
export function usableMethods(methods: PaymentMethod[], carrier: boolean): PaymentMethod[] {
  return methods.filter((method) => !(carrier && method.pickup_only));
}

export type PaymentMethodsState =
  | { status: 'idle' | 'loading'; methods: PaymentMethod[] | null; error: null }
  | { status: 'ready'; methods: PaymentMethod[]; error: null }
  | { status: 'error'; methods: PaymentMethod[] | null; error: unknown };

// Los medios de pago que acepta el local, pedidos una sola vez cuando hacen falta.
export function usePaymentMethods(storefront: Storefront) {
  const [state, setState] = useState<PaymentMethodsState>({ status: 'idle', methods: null, error: null });
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(
    (force = false) => {
      if (inFlight.current) return inFlight.current;
      if (!force && state.status === 'ready') return Promise.resolve();
      setState((previous) => ({ status: 'loading', methods: previous.methods, error: null }));
      const request = storefront
        .getPaymentMethods()
        .then(
          (methods) => setState({ status: 'ready', methods, error: null }),
          (error: unknown) => {
            // Sin la ruta (backend anterior a los pagos offline): sólo Openpay, como siempre.
            if (error instanceof StorefrontError && error.code === 'not_found') setState({ status: 'ready', methods: OPENPAY_ONLY, error: null });
            else setState((previous) => ({ status: 'error', methods: previous.methods, error }));
          },
        )
        .finally(() => {
          inFlight.current = null;
        });
      inFlight.current = request;
      return request;
    },
    [storefront, state.status],
  );

  return { ...state, load };
}
