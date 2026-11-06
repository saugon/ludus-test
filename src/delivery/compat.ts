import type { Checkout } from '@vertex/storefront-sdk';

type Delivery = Checkout['delivery'];

const PICKUP: Delivery = {
  kind: 'pickup',
  carrier: null,
  name: 'Retiro en el local',
  price: '0.00',
  address: null,
  status: null,
  tracking_number: null,
  tracking_url: null,
};

// Un backend sin envío a domicilio (Vertex antes de #4542) no manda `delivery` en los checkouts ni en
// los pedidos: todos son retiros en el local. Con esto la tienda funciona contra los dos.
export function withDelivery<T extends { delivery: Delivery }>(value: T): T {
  return value.delivery ? value : { ...value, delivery: PICKUP };
}
