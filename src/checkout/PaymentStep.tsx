import { paymentMethodTotal, StorefrontError, type PaymentMethod, type PaymentMethodName } from '@vertex/storefront-sdk';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { cartBlocked } from '../components/CartLines';
import { ErrorNotice } from '../components/ErrorNotice';
import mercadopagoLogo from '../assets/mercadopago.png';
import openpayLogo from '../assets/openpay.svg';
import { ArrowLeftIcon, CheckIcon } from '../components/Icons';
import { button, container } from '../components/ui';
import { messages, store, whatsappUrl } from '../content';
import { deliveryDays } from '../delivery/address';
import { money } from '../lib/format';
import { useStorefront } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';
import { isSessionError, useShopper } from '../shopper/ShopperProvider';
import { signInPath } from '../shopper/returnPath';
import { backLink, CheckoutFrame, STEP_PATHS, Summary } from './CheckoutFrame';
import { useCheckout } from './CheckoutProvider';
import { pageUrl } from '../lib/paths';
import { cartCode, cartCodeError, discountCodeRefusal, rejectsCode } from '../payment/discountCode';
import { holdHoursOf, holdText, PAYMENT_LABELS, paysOffline, paysOnline, percentText } from '../payment/methods';

type Phase = 'idle' | 'submitting' | 'redirecting';

// Una fila de la revisión: qué es, lo elegido y el link para cambiarlo en el paso Envío.
function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 px-4 py-4 sm:grid-cols-[6.5rem_1fr_auto] sm:px-5">
      <dt className="font-ui text-sm font-semibold uppercase tracking-[0.1em] text-mute sm:pt-px">{label}</dt>
      <dd className="col-span-2 row-start-2 min-w-0 space-y-1 text-base text-mute sm:col-span-1 sm:col-start-2 sm:row-start-1">{children}</dd>
      <dd className="col-start-2 row-start-1 sm:col-start-3">
        <Link to={STEP_PATHS.shipping} className="text-sm font-semibold text-mute underline underline-offset-4 hover:text-bone" aria-label={`Cambiar ${label.toLowerCase()}`}>
          Cambiar
        </Link>
      </dd>
    </div>
  );
}

// Lo que explica cada opción. El plazo de la reserva lo fija el local para cada medio.
function methodText({ method, hold_hours }: PaymentMethod): string {
  const hold = holdText(hold_hours);
  switch (method) {
    case 'openpay':
      return 'Te llevamos a Openpay para pagar y volvés acá con tu número de pedido.';
    case 'mercadopago':
      return 'Pagás con tu cuenta de Mercado Pago o con tarjeta, y volvés acá con tu número de pedido.';
    case 'transfer':
      return `Al confirmar te mostramos los datos de la cuenta. Te reservamos el pedido ${hold ? `${hold} ` : 'un tiempo '}para que transfieras.`;
    case 'cash':
      return `Pagás cuando lo retirás en ${store.address}. ${hold ? `Te lo reservamos ${hold}: pasá a buscarlo antes.` : 'Te lo reservamos un tiempo: pasá a buscarlo antes.'}`;
  }
}

const BUTTON_NOTE: Record<PaymentMethodName, string> = {
  openpay: 'Los datos de pago los cargás en Openpay: la tienda no los ve ni los guarda.',
  mercadopago: 'Los datos de pago los cargás en Mercado Pago: la tienda no los ve ni los guarda.',
  transfer: 'Después de confirmar te mostramos la cuenta a la que transferir.',
  cash: 'No pagás nada ahora: pagás en el local cuando lo retirás.',
};

// «10% OFF» al lado del nombre del medio que tiene descuento.
function DiscountBadge({ percent }: { percent: string | null }) {
  if (!percent || Number(percent) <= 0) return null;
  return (
    <span className="inline-flex rounded-md bg-moss/15 px-2 py-0.5 text-sm font-semibold text-moss ring-1 ring-moss/40">
      {percentText(percent)} OFF
    </span>
  );
}

// Una fila de la lista de medios: el nombre (o el logo del proveedor, si tiene) y debajo su explicación.
// `rejectsCode`: el medio no acepta el código de descuento del carrito y no se puede elegir mientras esté.
function MethodOption({ method, checked, onChange, rejectsCode = false }: { method: PaymentMethod; checked: boolean; onChange: () => void; rejectsCode?: boolean }) {
  return (
    <label
      className={`flex items-start gap-3 px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ember ${rejectsCode ? 'cursor-not-allowed opacity-60' : `cursor-pointer ${checked ? 'bg-ember/5' : 'hover:bg-ink-3'}`}`}
    >
      <input type="radio" name="medio-de-pago" value={method.method} checked={checked} onChange={onChange} disabled={rejectsCode} className="sr-only" />
      <span
        aria-hidden="true"
        className={`${method.method === 'openpay' || method.method === 'mercadopago' ? 'mt-2' : 'mt-0.5'} flex size-5 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-ember bg-ember text-ember-ink' : 'border-mute'}`}
      >
        {checked && <CheckIcon size={12} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {method.method === 'openpay' || method.method === 'mercadopago' ? (
            // El logo del proveedor en lugar del nombre.
            <span className="inline-flex rounded-md bg-white px-2.5 py-1.5">
              {method.method === 'openpay' ? (
                <img src={openpayLogo} alt="Openpay" width={138} height={34} className="h-6 w-auto" />
              ) : (
                <img src={mercadopagoLogo} alt="Mercado Pago" width={142} height={37} className="h-6 w-auto" />
              )}
            </span>
          ) : (
            <span className="font-semibold text-bone">{PAYMENT_LABELS[method.method]}</span>
          )}
          <DiscountBadge percent={method.discount_percent} />
        </span>
        <span className="mt-1 block text-sm text-mute">
          {rejectsCode ? 'No acepta códigos de descuento. Quitá el código para pagar con este medio.' : methodText(method)}
        </span>
      </span>
    </label>
  );
}

export function PaymentStep() {
  useTitle('Pago');
  const storefront = useStorefront();
  const cart = useCart();
  const session = useShopper();
  const navigate = useNavigate();
  const { buyer, member, checkingSession, delivery, shipping, payTotal: total, detailsComplete, payment, usableMethods, paymentMethod, setPaymentMethod } =
    useCheckout();
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState<unknown>(null);
  // El local dejó de aceptar el medio elegido entre que se cargó la lista y se confirmó.
  const [methodGone, setMethodGone] = useState<PaymentMethodName | null>(null);
  const { load: loadMethods } = payment;

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  const lines = cart.cart?.lines ?? [];
  const blocked = cartBlocked(lines, cart.shortages);
  // Un código que dejó de valer hace fallar el checkout: hay que quitarlo antes de pagar.
  const codeBlocked = cartCodeError(cart.cart) != null;
  const cartDiscountCode = cartCode(cart.cart);
  const busy = phase !== 'idle';
  const names = Object.fromEntries(lines.flatMap((line) => (line.code ? [[line.code, line.name ?? line.code]] : [])));

  if (checkingSession) {
    return (
      <div className={`${container} py-20 text-center text-mute`} role="status">
        Revisando tu sesión…
      </div>
    );
  }

  // Sin los datos del paso anterior (por ejemplo, después de recargar la página) no hay nada que pagar todavía.
  if (!detailsComplete && failure == null && !busy) return <Navigate to={STEP_PATHS.shipping} replace />;

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (blocked || codeBlocked || cart.saving || busy || !detailsComplete || !paymentMethod || (!paysOnline(paymentMethod) && !member)) return;

    setPhase('submitting');
    setFailure(null);
    setMethodGone(null);
    const returnUrl = pageUrl('/pedido');
    const buyerData = member ? { returnUrl } : { name: buyer.name.trim(), email: buyer.email.trim(), returnUrl };
    // Openpay es el medio por defecto: no se manda, así la tienda sigue andando contra un backend sin pagos offline.
    const method = paymentMethod === 'openpay' ? {} : { paymentMethod };
    try {
      const checkout = await storefront.checkout(
        shipping
          ? { ...buyerData, ...method, delivery: { option: shipping.code, phone: delivery.contact.phone.trim(), document: delivery.contact.document.trim() } }
          : { ...buyerData, ...method },
      );
      // Transferencia o efectivo: el pedido queda reservado y /pedido muestra cómo pagarlo.
      if (paysOffline(checkout)) {
        navigate('/pedido');
        return;
      }
      if (checkout.payment_url) {
        setPhase('redirecting');
        storefront.redirectToPayment(checkout);
        return;
      }
      if (checkout.status === 'paid' || checkout.status === 'attention') {
        navigate('/pedido');
        return;
      }
      setFailure(new Error(`checkout ${checkout.status} without payment_url`));
      setPhase('idle');
    } catch (error) {
      setPhase('idle');
      if (error instanceof StorefrontError && error.code === 'shipping_quote_expired') {
        // El aviso para volver a cotizar aparece en el paso Envío, con la dirección cargada.
        delivery.expire(error);
        navigate(STEP_PATHS.shipping);
        return;
      }
      if (error instanceof StorefrontError && error.code === 'insufficient_stock') {
        cart.reportShortages(error.lines);
        void cart.reload();
      }
      if (isSessionError(error)) session.expire();
      if (discountCodeRefusal(error)) {
        // El código dejó de valer (o el medio no lo acepta): el carrito vuelve con el motivo, al lado del código.
        void cart.reload();
        setFailure(error);
        return;
      }
      if (error instanceof StorefrontError && error.code === 'validation_error' && paymentMethod !== 'openpay') {
        // Puede ser que el local haya dejado de aceptar el medio: se vuelve a pedir la lista para ofrecer los que quedan.
        await loadMethods(true);
        setMethodGone(paymentMethod);
        return;
      }
      setFailure(error);
    }
  }

  const code = failure instanceof StorefrontError ? failure.code : null;
  const offline = paymentMethod != null && !paysOnline(paymentMethod);
  // El local sólo reserva pedidos por transferencia o en efectivo a quien ingresó con su cuenta.
  const needsSignIn = offline && !member;
  const cashHold = holdText(holdHoursOf(payment.methods, 'cash'));

  return (
    <CheckoutFrame
      step="payment"
      title="Revisá y pagá"
      onSubmit={pay}
      keepWhenEmpty={busy}
      aside={
        <Summary showItems shippingRow="chosen" withDiscount>
          <button type="submit" disabled={busy || blocked || codeBlocked || cart.saving || !detailsComplete || !paymentMethod || needsSignIn} className={`${button.primaryCompact} w-full`}>
            {offline
              ? busy
                ? 'Reservando tu pedido…'
                : `Confirmar pedido · ${money(total, cart.cart?.currency)}`
              : busy
                ? 'Preparando el pago…'
                : `Pagar ${money(total, cart.cart?.currency)}`}
          </button>
          {codeBlocked && <p className="text-center text-sm text-ember-hi">Quitá el código de descuento para poder pagar.</p>}
          {paymentMethod && (
            <p className="text-center text-xs text-mute">{needsSignIn ? 'Ingresá con tu email para confirmar el pedido.' : BUTTON_NOTE[paymentMethod]}</p>
          )}
        </Summary>
      }
    >
      <dl className="divide-y divide-line rounded-lg border border-line bg-ink-2">
        <ReviewRow label="Contacto">
          <p className="break-words">
            <span className="font-semibold text-bone">{member ? (session.shopper?.name ?? 'Tu cuenta') : buyer.name.trim()}</span>
            {(member ? session.shopper?.email : buyer.email.trim()) && (
              <>
                {' · '}
                <span>{member ? session.shopper?.email : buyer.email.trim()}</span>
              </>
            )}
          </p>
        </ReviewRow>
        <ReviewRow label="Entrega">
          {shipping ? (
            <>
              <p className="font-semibold text-bone">
                {shipping.name} · <span className="tabular-nums">{money(shipping.price, shipping.currency)}</span>
              </p>
              {delivery.quote.status === 'quoted' && <p className="text-bone/90">{delivery.quote.address}</p>}
              {deliveryDays(shipping.delivery_days) && <p>{deliveryDays(shipping.delivery_days)}</p>}
              <p className="text-sm">
                Tel. {delivery.contact.phone.trim()} · DNI {delivery.contact.document.trim()}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-bone">Retiro en el local · Gratis</p>
              <p className="text-bone/90">
                {paymentMethod === 'cash'
                  ? `${store.address}. Pagás en efectivo al retirarlo${cashHold ? `, dentro de las ${cashHold}` : ''}.`
                  : `${store.address}, cuando el pago esté aprobado. Traé tu número de pedido.`}
              </p>
              <p className="text-sm">{store.hours.map((slot) => `${slot.days}: ${slot.time}`).join('. ')}.</p>
            </>
          )}
        </ReviewRow>
      </dl>

      <section aria-labelledby="pago-titulo">
        <h2 id="pago-titulo" className="mb-3 font-sans text-lg font-semibold leading-tight tracking-normal [-webkit-text-stroke:0]">
          Pago
        </h2>
        {payment.methods === null && payment.status === 'error' ? (
          <ErrorNotice error={payment.error} onRetry={() => void loadMethods(true)} />
        ) : payment.methods === null ? (
          <p role="status" className="rounded-lg border border-line bg-ink-2 p-4 text-mute sm:p-5">
            Cargando los medios de pago…
          </p>
        ) : usableMethods.length === 0 ? (
          <div className="rounded-lg border border-line bg-ink-2 p-4 sm:p-5">
            <p className="font-semibold text-bone">
              {payment.methods.length > 0 ? 'Con envío a domicilio no hay medios de pago disponibles' : 'Ahora no hay medios de pago disponibles'}
            </p>
            <p className="mt-1 text-mute">
              {payment.methods.length > 0 ? (
                <>
                  El pago en efectivo es sólo para retirar en el local.{' '}
                  <Link to={STEP_PATHS.shipping} className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi">
                    Cambiar a retiro en el local
                  </Link>
                </>
              ) : (
                <>
                  Escribinos y lo resolvemos.{' '}
                  <a href={whatsappUrl(messages.general)} target="_blank" rel="noopener noreferrer" className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi">
                    Escribinos por WhatsApp
                  </a>
                </>
              )}
            </p>
          </div>
        ) : (
          <div role="radiogroup" aria-labelledby="pago-titulo" className="space-y-3">
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-ink-2">
              {usableMethods.map((method) => (
                <MethodOption
                  key={method.method}
                  method={method}
                  checked={method.method === paymentMethod}
                  onChange={() => setPaymentMethod(method.method)}
                  rejectsCode={rejectsCode(cart.cart?.payment_methods ? paymentMethodTotal(cart.cart, method.method) : null)}
                />
              ))}
            </div>
            {!paymentMethod && cartDiscountCode && (
              <p role="note" className="rounded-lg border border-ember/50 bg-ember/10 p-4 text-bone sm:p-5">
                Ninguno de los medios de pago de ahora acepta el código {cartDiscountCode.code}. Quitalo para poder pagar.
              </p>
            )}
            {needsSignIn && paymentMethod && (
              <div role="note" className="rounded-lg border border-ember/50 bg-ember/10 p-4 sm:p-5">
                <p className="text-bone">
                  Para pagar {paymentMethod === 'cash' ? 'en efectivo' : 'por transferencia'} tenés que ingresar con tu email. Así el pedido queda en tu cuenta y lo seguís
                  desde Mis pedidos.
                </p>
                <Link to={signInPath(STEP_PATHS.payment)} className={`${button.primaryCompact} mt-3`}>
                  Ingresar
                </Link>
              </div>
            )}
          </div>
        )}
        {methodGone && (
          <p role="alert" className="mt-3 rounded-lg border border-alert/40 bg-alert/10 p-4 text-bone">
            {usableMethods.some((method) => method.method === methodGone)
              ? paysOnline(methodGone)
                ? `No pudimos iniciar el pago con ${PAYMENT_LABELS[methodGone]}. Revisá tus datos y volvé a intentar.`
                : `No pudimos reservar el pedido con ${PAYMENT_LABELS[methodGone].toLowerCase()}. Revisá tus datos y volvé a intentar.`
              : `El local dejó de aceptar ${methodGone === 'mercadopago' ? PAYMENT_LABELS[methodGone] : PAYMENT_LABELS[methodGone].toLowerCase()}. Elegí otro medio de pago.`}
          </p>
        )}
      </section>

      {failure != null && (
        <ErrorNotice error={failure} names={names} context={shipping ? 'delivery' : undefined}>
          {code === 'insufficient_stock' && (
            <Link to={STEP_PATHS.cart} className="inline-flex h-11 items-center rounded-md bg-ember px-4 font-semibold text-ink">
              Ajustar en el carrito
            </Link>
          )}
          {code === 'cart_closed' && (
            <button type="button" onClick={() => { cart.startNewCart(); navigate('/productos'); }} className="h-11 rounded-md bg-ember px-4 font-semibold text-ink">
              Empezar un carrito nuevo
            </button>
          )}
          {isSessionError(failure) && (
            <>
              <Link to={signInPath(STEP_PATHS.payment)} className="inline-flex h-11 items-center rounded-md bg-ember px-4 font-semibold text-ink">
                Ingresar de nuevo
              </Link>
              <Link to={STEP_PATHS.shipping} className="inline-flex h-11 items-center rounded-md border border-line px-4 font-semibold hover:border-mute">
                Comprar sin cuenta
              </Link>
            </>
          )}
          {code === 'checkout_in_progress' && (
            <Link to="/pedido" className="inline-flex h-11 items-center rounded-md border border-line px-4 font-semibold hover:border-mute">
              Ver el estado del pago
            </Link>
          )}
        </ErrorNotice>
      )}

      {busy && (
        <p role="status" className="text-mute">
          {phase === 'submitting' ? 'Preparando el pago. Puede tardar unos segundos…' : 'Te llevamos a la página de pago…'}
        </p>
      )}

      <Link to={STEP_PATHS.shipping} className={backLink}>
        <ArrowLeftIcon size={16} /> Volver al envío
      </Link>
    </CheckoutFrame>
  );
}
