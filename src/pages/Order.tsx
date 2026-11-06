import type { Checkout } from '@vertex/storefront-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { useCheckout } from '../checkout/CheckoutProvider';
import { ErrorNotice } from '../components/ErrorNotice';
import { formatAddress } from '../delivery/address';
import { withDelivery } from '../delivery/compat';
import { AlertIcon, CheckIcon, ClockIcon, PinIcon, WhatsAppIcon } from '../components/Icons';
import { button, container } from '../components/ui';
import { messages, store, whatsappUrl } from '../content';
import { money } from '../lib/format';
import { useStorefront } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';
import { useShopper } from '../shopper/ShopperProvider';
import { ACCOUNT_PATH, signInPath } from '../shopper/returnPath';

type State =
  | { status: 'checking' }
  | { status: 'done'; checkout: Checkout | null }
  | { status: 'error'; error: unknown };

function Pickup() {
  return (
    <div className="rounded-lg border border-line bg-ink-2 p-5 text-left">
      <p className="flex items-start gap-2 font-semibold">
        <PinIcon size={20} className="mt-0.5 shrink-0 text-ember" />
        Retirá tu pedido en {store.address}
      </p>
      <p className="mt-2 text-mute">Traé tu número de pedido.</p>
      <ul className="mt-3 space-y-1 text-sm text-mute">
        {store.hours.map((slot) => (
          <li key={slot.days} className="flex items-start gap-2">
            <ClockIcon size={16} className="mt-0.5 shrink-0" />
            {slot.days}: {slot.time}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SHIPMENT: Record<NonNullable<Checkout['delivery']['status']>, string> = {
  pending: 'Estamos registrando el envío. Cuando el transporte lo tenga, vas a ver acá el número de seguimiento.',
  creating: 'Estamos registrando el envío. Cuando el transporte lo tenga, vas a ver acá el número de seguimiento.',
  created: 'El envío ya está registrado.',
  failed: 'Tuvimos un problema al registrar el envío. Lo estamos resolviendo y te avisamos por email.',
  cancel_pending: 'El envío se está cancelando. Si tenés dudas, escribinos.',
  cancelled: 'El envío se canceló. Si tenés dudas, escribinos.',
};

function HomeDelivery({ delivery, currency }: { delivery: Checkout['delivery']; currency: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-2 p-5 text-left">
      <p className="flex items-start gap-2 font-semibold">
        <PinIcon size={20} className="mt-0.5 shrink-0 text-ember" />
        {delivery.address ? `Te lo enviamos a ${formatAddress(delivery.address)}` : 'Te lo enviamos a tu domicilio'}
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-mute">Envío</dt>
        <dd>
          {delivery.name}: <span className="tabular-nums">{money(delivery.price, currency)}</span>
        </dd>
        {delivery.tracking_number && (
          <>
            <dt className="text-mute">Seguimiento</dt>
            <dd className="tabular-nums">{delivery.tracking_number}</dd>
          </>
        )}
      </dl>
      {delivery.status && <p className="mt-3 text-mute">{SHIPMENT[delivery.status]}</p>}
      {delivery.tracking_url && (
        <a href={delivery.tracking_url} target="_blank" rel="noopener noreferrer" className={`${button.secondary} mt-4`}>
          Seguir envío
        </a>
      )}
    </div>
  );
}

export function Order() {
  const storefront = useStorefront();
  const { reload } = useCart();
  const session = useShopper();
  const signedIn = session.status === 'member' || session.status === 'error';
  const [state, setState] = useState<State>({ status: 'checking' });
  const started = useRef(false);
  const { restoreDelivery, clear } = useCheckout();

  const check = useCallback(async () => {
    setState({ status: 'checking' });
    try {
      const checkout = await storefront.resumeCheckout();
      setState({ status: 'done', checkout: checkout && withDelivery(checkout) });
      void reload();
    } catch (error) {
      setState({ status: 'error', error });
    }
  }, [storefront, reload]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void check();
  }, [check]);

  const checkout = state.status === 'done' ? state.checkout : null;

  useEffect(() => {
    if (!checkout) return;
    // Pagado: lo que se guardó para esta compra ya no hace falta.
    if (checkout.status === 'paid') clear();
    // No se pagó: al reintentar, el paso Envío arranca con la misma dirección y la vuelve a cotizar.
    if (checkout.status === 'failed' && checkout.delivery.kind === 'carrier' && checkout.delivery.address) restoreDelivery(checkout.delivery.address);
    // Sólo cuando llega la respuesta: clear y restoreDelivery cambian en cada render del provider.
  }, [checkout]);
  useTitle(
    checkout?.status === 'paid'
      ? 'Pedido confirmado'
      : checkout?.status === 'failed'
        ? 'El pago no se completó'
        : 'Estado de tu pedido',
  );

  return (
    <div className={`${container} py-14 sm:py-20`}>
      <div className="mx-auto max-w-2xl">
      {state.status === 'checking' && (
        <div role="status" className="space-y-4 text-center">
          <span className="mx-auto block size-12 animate-spin rounded-full border-4 border-line border-t-ember" aria-hidden="true" />
          <h1 className="text-5xl">Confirmando tu pago</h1>
          <p className="text-lg text-mute">Estamos esperando la respuesta del medio de pago. No cierres esta página.</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-6">
          <h1 className="text-5xl">No pudimos consultar tu pedido</h1>
          <ErrorNotice error={state.error} onRetry={() => void check()} />
        </div>
      )}

      {state.status === 'done' && !checkout && (
        <div className="space-y-4 text-center">
          <h1 className="text-5xl">No hay un pago en curso</h1>
          <p className="text-lg text-mute">Si ya pagaste, revisá tu email: ahí está la confirmación con el número de pedido.</p>
          <Link to="/productos" className={button.primary}>
            Ver productos
          </Link>
        </div>
      )}

      {checkout?.status === 'paid' && (
        <div className="space-y-6 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-ember text-ink">
            <CheckIcon size={32} />
          </span>
          <h1 className="text-6xl">¡Gracias por tu compra!</h1>
          {checkout.sale_number != null && (
            <p className="text-xl">
              Tu número de pedido es <strong className="font-display text-4xl tracking-wide text-ember-hi">#{checkout.sale_number}</strong>
            </p>
          )}
          <p className="text-mute">
            Pagaste {money(checkout.total, checkout.currency)}
            {checkout.delivery.kind === 'carrier' && `, con ${money(checkout.delivery.price, checkout.currency)} de envío`}. Te mandamos la confirmación por
            email.
          </p>
          {checkout.delivery.kind === 'carrier' ? <HomeDelivery delivery={checkout.delivery} currency={checkout.currency} /> : <Pickup />}
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {signedIn && (
              <Link to={ACCOUNT_PATH} className={button.primary}>
                Ver mis pedidos
              </Link>
            )}
            <Link to="/productos" className={button.secondary}>
              Seguir comprando
            </Link>
          </div>
          {session.status === 'guest' && (
            <p className="text-mute">
              ¿Querés seguir el estado del {checkout.delivery.kind === 'carrier' ? 'envío' : 'retiro'}?{' '}
              <Link to={signInPath(ACCOUNT_PATH)} className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi">
                Ingresá con el email de la compra
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {checkout?.status === 'failed' && (
        <div className="space-y-6 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-alert/15 text-alert">
            <AlertIcon size={30} />
          </span>
          <h1 className="text-6xl">El pago no se completó</h1>
          <p className="text-lg text-mute">
            El pago fue rechazado o venció antes de terminarlo. No se te cobró nada y tu carrito sigue guardado.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/checkout" className={button.primary}>
              Volver a intentar
            </Link>
            <Link to="/productos" className={button.secondary}>
              Seguir comprando
            </Link>
          </div>
        </div>
      )}

      {checkout?.status === 'attention' && (
        <div className="space-y-6 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-ink-3 text-ember">
            <ClockIcon size={30} />
          </span>
          <h1 className="text-6xl">Estamos revisando tu pago</h1>
          <p className="text-lg text-mute">
            Hubo un problema al confirmar el pago y lo está revisando el local. Te vamos a contactar por email para resolverlo.
            No vuelvas a pagar mientras tanto.
          </p>
          <a href={whatsappUrl(messages.saleIssue(checkout.sale_number))} target="_blank" rel="noopener noreferrer" className={button.order}>
            <WhatsAppIcon /> Escribinos por WhatsApp
          </a>
        </div>
      )}

      {checkout && !['paid', 'failed', 'attention'].includes(checkout.status) && (
        <div className="space-y-6 text-center">
          <h1 className="text-5xl">Todavía no tenemos respuesta</h1>
          <p className="text-lg text-mute">
            El medio de pago no confirmó tu pago todavía. Si ya pagaste, en unos minutos te llega el email de confirmación.
          </p>
          <button type="button" onClick={() => void check()} className={button.primary}>
            Volver a consultar
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
