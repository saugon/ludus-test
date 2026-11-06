import {
  StorefrontError,
  type Cart,
  type Checkout,
  type DeliveryOption,
  type DeliveryOptions,
  type Product,
  type Shopper,
  type ShopperAccount,
  type ShopperOrder,
  type Storefront,
} from '@vertex/storefront-sdk';
import { vi, type Mock } from 'vitest';

export function product(overrides: Partial<Product> = {}): Product {
  return {
    code: 'CP-ORK',
    name: 'Combat Patrol: Orks',
    description: null,
    category: 'Miniaturas',
    image_url: null,
    price: '95000.00',
    currency: 'ARS',
    status: 'available',
    max_quantity: 3,
    ...overrides,
  };
}

export type LineSpec = { code: string; quantity: number; price?: number; max?: number; status?: 'available' | 'out_of_stock' | 'unavailable' };

export function cart(lines: LineSpec[], token = 'cart-1'): Cart {
  const built = lines.map(({ code, quantity, price = 1000, max = 5, status = 'available' }) => ({
    code,
    name: `Producto ${code}`,
    quantity,
    unit_price: `${price}.00`,
    total: `${price * quantity}.00`,
    status,
    max_quantity: max,
  }));
  const total = lines.reduce((sum, { quantity, price = 1000 }) => sum + price * quantity, 0);
  return { token, currency: 'ARS', total: `${total}.00`, lines: built, checkout: null };
}

export function checkout(status: Checkout['status'], overrides: Partial<Checkout> = {}): Checkout {
  return {
    token: 'chk-1',
    status,
    total: '95000.00',
    currency: 'ARS',
    expires_at: '2026-11-02T15:15:00Z',
    payment_url: status === 'awaiting_payment' ? 'https://pay.example.com/orders/1' : null,
    sale_number: status === 'paid' ? 1042 : null,
    delivery: pickupDelivery(),
    ...overrides,
  };
}

export function pickupDelivery(): Checkout['delivery'] {
  return { kind: 'pickup', carrier: null, name: 'Retiro en el local', price: '0.00', address: null, status: null, tracking_number: null, tracking_url: null };
}

export function carrierDelivery(overrides: Partial<Checkout['delivery']> = {}): Checkout['delivery'] {
  return {
    kind: 'carrier',
    carrier: 'andreani',
    name: 'Andreani a domicilio',
    price: '8500.00',
    address: { street: 'Av. Corrientes', number: '1234', floor: '3', apartment: 'B', postal_code: '1043', city: 'CABA', province: 'CABA' },
    status: 'pending',
    tracking_number: null,
    tracking_url: null,
    ...overrides,
  };
}

export function pickupOption(): DeliveryOption {
  return { kind: 'pickup', carrier: null, code: 'pickup', name: 'Retiro en el local', price: '0.00', currency: 'ARS', delivery_days: null, expires_at: null };
}

export function andreaniOption(overrides: Partial<DeliveryOption> = {}): DeliveryOption {
  return {
    kind: 'carrier',
    carrier: 'andreani',
    code: 'quote-1',
    name: 'Andreani a domicilio',
    price: '8500.00',
    currency: 'ARS',
    delivery_days: 3,
    expires_at: '2026-11-02T15:30:00Z',
    ...overrides,
  };
}

export function deliveryOptions(carrier: DeliveryOption[] = [andreaniOption()], unavailable: DeliveryOptions['unavailable'] = []): DeliveryOptions {
  return { options: [pickupOption(), ...carrier], unavailable };
}

export function shopper(overrides: Partial<Shopper> = {}): Shopper {
  return { name: 'Ana Gómez', email: 'ana@example.com', ...overrides };
}

export function order(overrides: Partial<ShopperOrder> = {}): ShopperOrder {
  return {
    sale_number: 1042,
    status: 'paid',
    fulfillment_status: 'pending',
    created_at: '2026-11-04T21:30:00Z',
    currency: 'ARS',
    total: '190000.00',
    lines: [{ code: 'CP-ORK', name: 'Combat Patrol: Orks', quantity: 2, unit_price: '95000.00', total: '190000.00' }],
    delivery: pickupDelivery(),
    ...overrides,
  };
}

export function sdkError(code: StorefrontError['code'], status: number | null = 409, lines: StorefrontError['lines'] = [], retryAfter: number | null = null) {
  return new StorefrontError(code, code, status, lines, retryAfter);
}

type Mocked<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? Mock<T[K]> : never };

export type FakeShopper = Mocked<ShopperAccount>;
export type FakeStorefront = Omit<Mocked<Storefront>, 'shopper'> & { shopper: FakeShopper };

type Overrides = Partial<Omit<Storefront, 'shopper'>> & { shopper?: Partial<ShopperAccount> };

function applyOverrides(fake: object, overrides: object) {
  for (const [key, implementation] of Object.entries(overrides)) {
    (fake as Record<string, Mock>)[key].mockImplementation(implementation as never);
  }
}

export function fakeStorefront({ shopper: shopperOverrides = {}, ...overrides }: Overrides = {}): FakeStorefront & Storefront {
  const account: FakeShopper = {
    requestCode: vi.fn<ShopperAccount['requestCode']>(async () => ({ expiresIn: 600 })),
    signIn: vi.fn<ShopperAccount['signIn']>(async () => ({ status: 'signed_in', shopper: shopper() })),
    completeSignUp: vi.fn<ShopperAccount['completeSignUp']>(async (name) => shopper({ name })),
    signOut: vi.fn<ShopperAccount['signOut']>(),
    isSignedIn: vi.fn<ShopperAccount['isSignedIn']>(() => false),
    get: vi.fn<ShopperAccount['get']>(async () => null),
    orders: vi.fn<ShopperAccount['orders']>(async () => ({ orders: [], nextCursor: null })),
  };
  applyOverrides(account, shopperOverrides);

  const fake: FakeStorefront = {
    listProducts: vi.fn<Storefront['listProducts']>(async () => []),
    listProductsPage: vi.fn<Storefront['listProductsPage']>(async () => ({ products: [], nextCursor: null })),
    getProduct: vi.fn<Storefront['getProduct']>(async (code) => product({ code })),
    getCart: vi.fn<Storefront['getCart']>(async () => null),
    setCartLines: vi.fn<Storefront['setCartLines']>(async (lines) => cart(lines.map((line) => ({ ...line })))),
    getDeliveryOptions: vi.fn<Storefront['getDeliveryOptions']>(async () => deliveryOptions()),
    checkout: vi.fn<Storefront['checkout']>(async () => checkout('awaiting_payment')),
    redirectToPayment: vi.fn<Storefront['redirectToPayment']>(),
    resumeCheckout: vi.fn<Storefront['resumeCheckout']>(async () => null),
    getCheckout: vi.fn<Storefront['getCheckout']>(async () => checkout('awaiting_payment')),
    shopper: account,
  };
  applyOverrides(fake, overrides);
  return fake as FakeStorefront & Storefront;
}

export function signedIn(who: Shopper = shopper()): Partial<ShopperAccount> {
  return { isSignedIn: () => true, get: async () => who };
}
