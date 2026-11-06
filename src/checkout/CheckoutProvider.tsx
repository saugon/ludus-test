import type { DeliveryAddress, DeliveryOption } from '@vertex/storefront-sdk';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useCart } from '../cart/CartProvider';
import { addAmounts } from '../delivery/address';
import { useDelivery, type Delivery } from '../delivery/DeliveryChoice';
import { EMAIL_ERROR, isEmail } from '../lib/email';
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
  total: string | undefined;
  // Si están los datos del paso «Envío» para poder pagar.
  detailsComplete: boolean;
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
  const { phone, document } = delivery.contact;

  useEffect(() => {
    writeDraft({ name: buyer.name, email: buyer.email, phone, document });
  }, [buyer.name, buyer.email, phone, document]);

  const member = session.status === 'member' || session.status === 'error';
  const buyerErrors = validateBuyer(buyer);
  const shipping = delivery.method === 'carrier' ? delivery.chosen : null;
  const total = shipping ? (addAmounts(cart.cart?.total, shipping.price) ?? cart.cart?.total) : cart.cart?.total;
  const buyerOk = member || (!buyerErrors.name && !buyerErrors.email);
  const contactOk = !shipping || (!delivery.contactErrors.phone && !delivery.contactErrors.document);

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
    detailsComplete: buyerOk && delivery.ready && contactOk,
    restoreDelivery: delivery.restore,
    clear: () => {
      delivery.reset();
      setBuyer({ name: '', email: '' });
      setBuyerTouched({ name: false, email: false });
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
