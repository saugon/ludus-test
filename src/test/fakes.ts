import {
  StorefrontError,
  type Cart,
  type Checkout,
  type DeliveryOption,
  type DeliveryOptions,
  type PaymentMethod,
  type PaymentMethodName,
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
    presale: false,
    presale_available_on: null,
    featured: false,
    subcategory: null,
    ...overrides,
  };
}

export type LineSpec = { code: string; quantity: number; price?: number; max?: number; status?: 'available' | 'out_of_stock' | 'unavailable' };

// `discounts` da el porcentaje que el local descuenta con cada medio; sin él, el carrito no trae precios por medio.
export function cart(lines: LineSpec[], token = 'cart-1', discounts: Partial<Record<PaymentMethodName, number | null>> = {}): Cart {
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
  const payment_methods = Object.entries(discounts).map(([method, percent]) => {
    const discount = percent ? Math.round((total * percent) / 100) : 0;
    return {
      method: method as PaymentMethodName,
      discount_percent: percent ? `${percent}.00` : null,
      discount: `${discount}.00`,
      total: `${total - discount}.00`,
      discount_code_amount: '0.00',
      discount_code_status: null,
    };
  });
  return {
    token,
    currency: 'ARS',
    total: `${total}.00`,
    lines: built,
    payment_methods,
    checkout: null,
    discount_code: null,
    discount_code_error: null,
    total_with_discount_code: `${total}.00`,
  };
}

export function checkout(status: Checkout['status'], overrides: Partial<Checkout> = {}): Checkout {
  return {
    token: 'chk-1',
    status,
    subtotal: '95000.00',
    discount: null,
    discount_code: null,
    total: '95000.00',
    currency: 'ARS',
    order_number: 7,
    expires_at: '2026-11-02T15:15:00Z',
    payment_url: status === 'awaiting_payment' ? 'https://pay.example.com/orders/1' : null,
    sale_number: status === 'paid' ? 1042 : null,
    delivery: pickupDelivery(),
    payment_method: 'openpay',
    transfer: null,
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
    subtotal: '190000.00',
    discount: null,
    discount_code: null,
    total: '190000.00',
    order_number: 1042,
    lines: [{ code: 'CP-ORK', name: 'Combat Patrol: Orks', quantity: 2, unit_price: '95000.00', total: '190000.00', presale: false }],
    presale: false,
    payment_method: 'openpay',
    delivery: pickupDelivery(),
    ...overrides,
  };
}

export function transferAccount(): NonNullable<Checkout['transfer']> {
  return { account_type: 'alias', account_value: 'ludus.games.mp', holder: 'Ludus SRL', cuit: '30-71234567-8', bank: 'Mercado Pago' };
}

// Openpay, transferencia y efectivo, como los lista un local que acepta los tres.
export function paymentMethods(): PaymentMethod[] {
  return [
    { method: 'openpay', pickup_only: false, transfer: null, hold_hours: null, discount_percent: null },
    { method: 'transfer', pickup_only: false, transfer: transferAccount(), hold_hours: 24, discount_percent: null },
    { method: 'cash', pickup_only: true, transfer: null, hold_hours: 24, discount_percent: null },
  ];
}

export function sdkError(
  code: StorefrontError['code'],
  status: number | null = 409,
  lines: StorefrontError['lines'] = [],
  retryAfter: number | null = null,
  details: StorefrontError['details'] = [],
) {
  return new StorefrontError(code, code, status, lines, retryAfter, details);
}

// Un 422 que rechaza el código de descuento, como al aplicarlo («discount_code_expired») o al pagar.
export function codeRefusal(reason: string, field = 'code') {
  return sdkError('validation_error', 422, [], null, [{ field, code: `discount_code_${reason}`, message: reason }]);
}

// El carrito con un código aplicado. `methods`, cómo se combina con cada medio: `applied` descuenta `amount`,
// `outweighed` no descuenta nada y `not_allowed` no se puede pagar con ese medio.
export function withCode(
  base: Cart,
  { code = 'BIENVENIDA10', amount, error = null, methods = {} }: { code?: string; amount: number; error?: Cart['discount_code_error']; methods?: Partial<Record<PaymentMethodName, 'applied' | 'outweighed' | 'not_allowed'>> },
): Cart {
  const total = Number(base.total);
  const off = error ? 0 : amount;
  return {
    ...base,
    discount_code: { code, amount: `${amount}.00`, stacking: 'stack', value: `${amount}.00`, value_type: 'fixed' },
    discount_code_error: error,
    total_with_discount_code: `${total - off}.00`,
    payment_methods: base.payment_methods.map((priced) => {
      const status = methods[priced.method] ?? (error ? null : 'applied');
      const codeAmount = status === 'applied' ? off : 0;
      return {
        ...priced,
        discount_code_status: status,
        discount_code_amount: `${codeAmount}.00`,
        total: `${Number(priced.total) - codeAmount}.00`,
      };
    }),
  };
}

type Mocked<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? Mock<T[K]> : never };

export type FakeShopper = Mocked<ShopperAccount>;
export type FakeStorefront = Omit<Mocked<Storefront>, 'shopper'> & { shopper: FakeShopper };

// `products`: el catálogo, en una sola página de listProductsPage. `listCategories` falla con 404 salvo que se pase,
// como un backend sin GET /categories: la tienda arma las categorías con los productos.
type Overrides = Partial<Omit<Storefront, 'shopper'>> & { shopper?: Partial<ShopperAccount>; products?: Product[] };

function applyOverrides(fake: object, overrides: object) {
  for (const [key, implementation] of Object.entries(overrides)) {
    (fake as Record<string, Mock>)[key].mockImplementation(implementation as never);
  }
}

export function fakeStorefront({ shopper: shopperOverrides = {}, products = [], ...overrides }: Overrides = {}): FakeStorefront & Storefront {
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
    listFeaturedProducts: vi.fn<Storefront['listFeaturedProducts']>(async () => []),
    listProductsPage: vi.fn<Storefront['listProductsPage']>(async () => ({ products, nextCursor: null })),
    listProductsByPage: vi.fn<Storefront['listProductsByPage']>(async ({ page }) => ({ products, total: products.length, page })),
    listCategories: vi.fn<Storefront['listCategories']>(async () => Promise.reject(sdkError('not_found', 404))),
    getProduct: vi.fn<Storefront['getProduct']>(async (code) => product({ code })),
    getCart: vi.fn<Storefront['getCart']>(async () => null),
    setCartLines: vi.fn<Storefront['setCartLines']>(async (lines) => cart(lines.map((line) => ({ ...line })))),
    applyDiscountCode: vi.fn<Storefront['applyDiscountCode']>(async () => Promise.reject(sdkError('not_found', 404))),
    removeDiscountCode: vi.fn<Storefront['removeDiscountCode']>(async () => Promise.reject(sdkError('not_found', 404))),
    getDeliveryOptions: vi.fn<Storefront['getDeliveryOptions']>(async () => deliveryOptions()),
    getPaymentMethods: vi.fn<Storefront['getPaymentMethods']>(async () => [{ method: 'openpay', pickup_only: false, transfer: null, hold_hours: null, discount_percent: null }]),
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
