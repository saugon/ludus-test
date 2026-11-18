import { paymentMethodTotal, type CartPaymentMethod, type DeliveryAddress, type DeliveryOption, type PaymentMethod, type PaymentMethodName } from '@vertex/storefront-sdk';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useCart } from '../cart/CartProvider';
import { addAmounts } from '../delivery/address';
import { useDelivery, type Delivery } from '../delivery/DeliveryChoice';
import { EMAIL_ERROR, isEmail } from '../lib/email';
import { useStorefront } from '../lib/storefront';
import { rejectsCode, totalWithCode } from '../payment/discountCode';
import { discountedPrice, usableMethods, usePaymentMethods, type PaymentMethodsState } from '../payment/methods';
import { useShopper } from '../shopper/ShopperProvider';

export type Buyer = { name: string; email: string };
export type BuyerErrors = Partial<Record<keyof Buyer, string>>;

export function validateBuyer({ name, email }: Buyer): BuyerErrors {
  const errors: BuyerErrors = {};
  if (name.trim().length < 2) errors.name = 'Escribí tu nombre y apellido.';
  if (!isEmail(email)) errors.email = EMAIL_ERROR;
  return errors;
}

// Lo que la API no devuelve a propósito (nombre y email del invitado, teléfono y DNI) se guarda en
// sessionStorage mientras dura la compra, así un pago rechazado se reintenta sin escribirlo de nuevo:
// el pago de Openpay recarga la página. Se borra al pagar y al cerrar la pestaña.
export const DRAFT_KEY = 'ludus:checkout';

type Draft = Buyer & { phone: string; document: string };

const EMPTY_DRAFT: Draft = { name: '', email: '', phone: '', document: '' };

function readDraft(): Draft {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null;
    if (!saved || typeof saved !== 'object') return EMPTY_DRAFT;
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    return { name: text(saved.name), email: text(saved.email), phone: text(saved.phone), document: text(saved.document) };
  } catch {
    return EMPTY_DRAFT;
  }
}

function writeDraft(draft: Draft) {
  try {
    if (Object.values(draft).every((value) => value === '')) sessionStorage.removeItem(DRAFT_KEY);
    else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Sin sessionStorage (modo privado estricto) la compra funciona igual; sólo no se recuerda.
  }
}

type CheckoutValue = {
  buyer: Buyer;
  setBuyer: (buyer: Buyer) => void;
  buyerTouched: Record<keyof Buyer, boolean>;
  touchBuyer: (field?: keyof Buyer) => void;
  buyerErrors: BuyerErrors;
  // Con sesión, el backend usa el nombre y el email de la cuenta.
  member: boolean;
  checkingSession: boolean;
  delivery: Delivery;
  // La opción de envío elegida y vigente, o null si es retiro o todavía no hay una.
  shipping: DeliveryOption | null;
  // Productos con el código de descuento, más el envío; sin el descuento del medio de pago.
  total: string | undefined;
  // El descuento del medio elegido sobre los productos (null si no tiene) y lo que se paga con él, envío incluido.
  discount: CartPaymentMethod | null;
  // Cómo queda el carrito con el medio elegido: lo que descuenta el código con ese medio y cómo se combina con el
  // del medio. null con un backend que no manda precios por medio.
  priced: CartPaymentMethod | null;
  payTotal: string | undefined;
  // Si están los datos del paso «Envío» para poder pagar.
  detailsComplete: boolean;
  // Los medios de pago del local (se piden la primera vez que hacen falta) y los que sirven con la entrega elegida.
  payment: PaymentMethodsState & { load: (force?: boolean) => Promise<void> };
  usableMethods: PaymentMethod[];
  // El medio elegido, o el primero que sirve y acepta el código del carrito; null si no hay ninguno.
  paymentMethod: PaymentMethodName | null;
  setPaymentMethod: (method: PaymentMethodName) => void;
  // Volvió un checkout que no se pagó: carga su dirección para reintentar.
  restoreDelivery: (address: DeliveryAddress) => void;
  // Se pagó: olvida todo lo de esta compra.
  clear: () => void;
};

const CheckoutContext = createContext<CheckoutValue | null>(null);

// Guarda lo que se completa en los pasos de la compra mientras se navega entre ellos, incluso si el
// comprador va a ingresar y vuelve. Una recarga conserva el borrador de sessionStorage; la dirección
// se pierde, salvo la de un checkout que vuelve sin pagar (/pedido la restaura).
export function CheckoutProvider({ homeDelivery = true, children }: { homeDelivery?: boolean; children: ReactNode }) {
  const cart = useCart();
  const session = useShopper();
  const [initial] = useState(readDraft);
  const delivery = useDelivery(cart.cart?.lines ?? [], { phone: initial.phone, document: initial.document }, homeDelivery);
  const [buyer, setBuyer] = useState<Buyer>({ name: initial.name, email: initial.email });
  const [buyerTouched, setBuyerTouched] = useState({ name: false, email: false });
  const payment = usePaymentMethods(useStorefront());
  const [chosenMethod, setPaymentMethod] = useState<PaymentMethodName | null>(null);
  const { phone, document } = delivery.contact;

  useEffect(() => {
    writeDraft({ name: buyer.name, email: buyer.email, phone, document });
  }, [buyer.name, buyer.email, phone, document]);

  const member = session.status === 'member' || session.status === 'error';
  const buyerErrors = validateBuyer(buyer);
  const shipping = delivery.method === 'carrier' ? delivery.chosen : null;
  const products = totalWithCode(cart.cart);
  const total = shipping ? (addAmounts(products, shipping.price) ?? products) : products;
  const buyerOk = member || (!buyerErrors.name && !buyerErrors.email);
  const contactOk = !shipping || (!delivery.contactErrors.phone && !delivery.contactErrors.document);
  const usable = usableMethods(payment.methods ?? [], shipping != null);
  const pricedWith = (method: PaymentMethodName) => (cart.cart?.payment_methods ? paymentMethodTotal(cart.cart, method) : null);
  // Con un código, Openpay no se puede elegir: se pasa al primero que lo acepta.
  const selectable = usable.filter((method) => !rejectsCode(pricedWith(method.method)));
  const paymentMethod = selectable.some((method) => method.method === chosenMethod) ? chosenMethod : (selectable[0]?.method ?? null);
  // Los descuentos son sobre los productos: el envío se suma después.
  const discount = discountedPrice(cart.cart, paymentMethod);
  const priced = paymentMethod ? pricedWith(paymentMethod) : null;
  const payTotal = priced ? (shipping ? (addAmounts(priced.total, shipping.price) ?? total) : priced.total) : total;

  const value: CheckoutValue = {
    buyer,
    setBuyer,
    buyerTouched,
    touchBuyer: (field) => setBuyerTouched((before) => (field ? { ...before, [field]: true } : { name: true, email: true })),
    buyerErrors,
    member,
    checkingSession: session.status === 'loading',
    delivery,
    shipping,
    total,
    discount,
    priced,
    payTotal,
    detailsComplete: buyerOk && delivery.ready && contactOk,
    payment,
    usableMethods: usable,
    paymentMethod,
    setPaymentMethod,
    restoreDelivery: delivery.restore,
    clear: () => {
      delivery.reset();
      setBuyer({ name: '', email: '' });
      setBuyerTouched({ name: false, email: false });
      setPaymentMethod(null);
      writeDraft(EMPTY_DRAFT);
    },
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutValue {
  const value = useContext(CheckoutContext);
  if (!value) throw new Error('useCheckout needs a CheckoutProvider');
  return value;
}
