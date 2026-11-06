import type { ShopperOrder } from '@vertex/storefront-sdk';

export type Tone = 'ready' | 'progress' | 'done' | 'problem';

export type OrderView = { label: string; tone: Tone; hint: string };

const PAYMENT: Record<ShopperOrder['status'], string> = {
  creating_order: 'Pago pendiente',
  awaiting_payment: 'Pago pendiente',
  approved: 'Confirmando el pago',
  paid: 'Pagado',
  failed: 'Pago no completado',
  attention: 'Pago en revisión',
};

const PICKUP: Record<NonNullable<ShopperOrder['fulfillment_status']>, string> = {
  pending: 'En preparación',
  ready: 'Listo para retirar',
  picked_up: 'Retirado',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export function paymentLabel(status: ShopperOrder['status']): string {
  return PAYMENT[status];
}

export function pickupLabel(status: ShopperOrder['fulfillment_status']): string | null {
  return status ? PICKUP[status] : null;
}

const SHIPMENT: Record<NonNullable<ShopperOrder['delivery']['status']>, string> = {
  pending: 'Registrando el envío',
  creating: 'Registrando el envío',
  created: 'Registrado en el transporte',
  failed: 'No se pudo registrar; lo estamos resolviendo',
  cancel_pending: 'Cancelándose',
  cancelled: 'Cancelado',
};

export function shipmentLabel(status: ShopperOrder['delivery']['status']): string | null {
  return status ? SHIPMENT[status] : null;
}

type DescribedOrder = Pick<ShopperOrder, 'status' | 'fulfillment_status'> & { delivery?: Pick<ShopperOrder['delivery'], 'kind'> };

export function describeOrder(order: DescribedOrder, address: string): OrderView {
  if (order.fulfillment_status === 'cancelled') {
    return { label: 'Cancelado', tone: 'problem', hint: 'El local canceló este pedido. Si tenés dudas, escribinos.' };
  }

  if (order.status === 'paid' && order.delivery?.kind === 'carrier') {
    switch (order.fulfillment_status) {
      case 'shipped':
        return { label: 'En camino', tone: 'progress', hint: 'Lo despachamos y está viajando a tu domicilio.' };
      case 'delivered':
        return { label: 'Entregado', tone: 'done', hint: 'Ya llegó a tu domicilio. ¡Que lo disfrutes!' };
      case 'ready':
        return { label: 'Listo para despachar', tone: 'progress', hint: 'Ya está preparado y sale en breve hacia tu domicilio.' };
      default:
        return { label: 'En preparación', tone: 'progress', hint: 'Lo estamos preparando para enviártelo.' };
    }
  }

  if (order.status === 'paid') {
    switch (order.fulfillment_status) {
      case 'ready':
        return { label: 'Listo para retirar', tone: 'ready', hint: `Pasá a buscarlo por ${address} con tu número de pedido.` };
      case 'picked_up':
        return { label: 'Retirado', tone: 'done', hint: 'Ya lo retiraste. ¡Que lo disfrutes!' };
      case 'shipped':
        return { label: 'En camino', tone: 'progress', hint: 'Lo despachamos y está viajando a tu domicilio.' };
      case 'delivered':
        return { label: 'Entregado', tone: 'done', hint: 'Ya llegó a tu domicilio. ¡Que lo disfrutes!' };
      default:
        return { label: 'En preparación', tone: 'progress', hint: 'Lo estamos preparando.' };
    }
  }

  switch (order.status) {
    case 'attention':
      return { label: 'Pago en revisión', tone: 'problem', hint: 'El local está revisando el pago. No vuelvas a pagar mientras tanto.' };
    case 'failed':
      return { label: 'Pago no completado', tone: 'problem', hint: 'El pago fue rechazado o venció. No se te cobró nada.' };
    case 'approved':
      return { label: 'Confirmando el pago', tone: 'progress', hint: 'El medio de pago aprobó el pago y lo estamos confirmando.' };
    default:
      return { label: 'Pago pendiente', tone: 'progress', hint: 'Todavía no recibimos el pago de este pedido.' };
  }
}

export type OrderProgress = { steps: string[]; current: number };

const PICKUP_STEPS = ['Pagado', 'En preparación', 'Listo para retirar', 'Retirado'];
const CARRIER_STEPS = ['Pagado', 'En preparación', 'En camino', 'Entregado'];

// Por dónde va un pedido pagado, para la barra de progreso. Sin pago o cancelado no hay progreso que mostrar.
// Con envío, «listo para despachar» sigue en preparación para el comprador: todavía no salió.
export function orderProgress(order: Pick<ShopperOrder, 'status' | 'fulfillment_status' | 'delivery'>): OrderProgress | null {
  if (order.status !== 'paid' || order.fulfillment_status === 'cancelled') return null;
  if (order.delivery.kind === 'carrier') {
    const current = order.fulfillment_status === 'delivered' ? 3 : order.fulfillment_status === 'shipped' ? 2 : 1;
    return { steps: CARRIER_STEPS, current };
  }
  const current = order.fulfillment_status === 'picked_up' ? 3 : order.fulfillment_status === 'ready' ? 2 : 1;
  return { steps: PICKUP_STEPS, current };
}

const shortDateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
});

// «6 nov 2026», para la lista de pedidos.
export function orderDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : shortDateFormat.format(date).replace(/ de /g, ' ');
}

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
});

export function orderDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date).replace(/ de /g, ' ');
}
