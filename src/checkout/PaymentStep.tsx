import { StorefrontError } from '@vertex/storefront-sdk';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { cartBlocked } from '../components/CartLines';
import { ErrorNotice } from '../components/ErrorNotice';
import openpayLogo from '../assets/openpay.svg';
import { ArrowLeftIcon, CheckIcon } from '../components/Icons';
import { button, container } from '../components/ui';
import { store } from '../content';
import { deliveryDays } from '../delivery/address';
import { money } from '../lib/format';
import { useStorefront } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';
import { isSessionError, useShopper } from '../shopper/ShopperProvider';
import { signInPath } from '../shopper/returnPath';
import { backLink, CheckoutFrame, STEP_PATHS, Summary } from './CheckoutFrame';
import { useCheckout } from './CheckoutProvider';
import { pageUrl } from '../lib/paths';

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

export function PaymentStep() {
  useTitle('Pago');
  const storefront = useStorefront();
  const cart = useCart();
  const session = useShopper();
  const navigate = useNavigate();
  const { buyer, member, checkingSession, delivery, shipping, total, detailsComplete } = useCheckout();
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState<unknown>(null);

  const lines = cart.cart?.lines ?? [];
  const blocked = cartBlocked(lines, cart.shortages);
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
    if (blocked || cart.saving || busy || !detailsComplete) return;

    setPhase('submitting');
    setFailure(null);
    const returnUrl = pageUrl('/pedido');
    const buyerData = member ? { returnUrl } : { name: buyer.name.trim(), email: buyer.email.trim(), returnUrl };
    try {
      const checkout = await storefront.checkout(
        shipping
          ? { ...buyerData, delivery: { option: shipping.code, phone: delivery.contact.phone.trim(), document: delivery.contact.document.trim() } }
          : buyerData,
      );
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
      setFailure(error);
    }
  }

  const code = failure instanceof StorefrontError ? failure.code : null;

  return (
    <CheckoutFrame
      step="payment"
      title="Revisá y pagá"
      onSubmit={pay}
      keepWhenEmpty={busy}
      aside={
        <Summary showItems shippingRow="chosen">
          <button type="submit" disabled={busy || blocked || cart.saving || !detailsComplete} className={`${button.primaryCompact} w-full`}>
            {busy ? 'Preparando el pago…' : `Pagar ${money(total, cart.cart?.currency)}`}
          </button>
          <p className="text-center text-xs text-mute">Los datos de pago los cargás en Openpay: la tienda no los ve ni los guarda.</p>
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
              <p className="text-bone/90">{store.address}, cuando el pago esté aprobado. Traé tu número de pedido.</p>
              <p className="text-sm">{store.hours.map((slot) => `${slot.days}: ${slot.time}`).join('. ')}.</p>
            </>
          )}
        </ReviewRow>
      </dl>

      <section aria-labelledby="pago-titulo">
        <h2 id="pago-titulo" className="mb-3 font-sans text-lg font-semibold leading-tight tracking-normal [-webkit-text-stroke:0]">
          Pago
        </h2>
        {/* Openpay es el único medio de pago: queda elegido, igual que una opción de envío elegida. */}
        <label className="flex items-start gap-4 rounded-lg border border-ember bg-ember/5 p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember sm:p-5">
          <input type="radio" name="medio-de-pago" value="openpay" checked readOnly className="peer sr-only" />
          <span
            aria-hidden="true"
            className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full border border-ember bg-ember text-ember-ink"
          >
            <CheckIcon size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="inline-flex rounded-md bg-white px-3 py-2">
              <img src={openpayLogo} alt="Openpay" width={138} height={34} className="h-6 w-auto" />
            </span>
            <span className="mt-2 block text-mute">Te llevamos a Openpay para pagar y volvés acá con tu número de pedido.</span>
          </span>
        </label>
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
