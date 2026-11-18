import type { Checkout } from '@vertex/storefront-sdk';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { useCheckout } from '../checkout/CheckoutProvider';
import { ErrorNotice } from '../components/ErrorNotice';
import { FollowOrder, rememberOrderBuyer } from '../components/FollowOrder';
import { formatAddress } from '../delivery/address';
import { withDelivery } from '../delivery/compat';
import { AlertIcon, CheckIcon, ClockIcon, PinIcon, WhatsAppIcon } from '../components/Icons';
import { button, container } from '../components/ui';
import { messages, store, whatsappUrl } from '../content';
import { money } from '../lib/format';
import { useStorefront } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';
import { useShopper } from '../shopper/ShopperProvider';
import { ACCOUNT_PATH } from '../shopper/returnPath';
import { holdDeadline, orderNumber } from '../shopper/orderStatus';
import { TransferDetails } from '../payment/TransferDetails';
import { awaitsOfflinePayment, DISCOUNT_LABELS, paymentMethodOf, paysOffline, percentText } from '../payment/methods';

type State =
  | { status: 'checking' }
  | { status: 'done'; checkout: Checkout | null }
  | { status: 'error'; error: unknown };

function Pickup({ note = 'Traé tu número de pedido.' }: { note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-2 p-5 text-left sm:p-6">
      <p className="flex items-start gap-2 font-semibold">
        <PinIcon size={20} className="mt-0.5 shrink-0 text-ember" />
        Retirá tu pedido en {store.address}
      </p>
      <p className="mt-2 text-mute">{note}</p>
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

// Transferencia o efectivo: el pedido está reservado hasta que el local confirme el pago.
function OfflinePending({ checkout, signedIn, follow, onCheck }: { checkout: Checkout; signedIn: boolean; follow: ReactNode; onCheck: () => void }) {
  const transfer = paymentMethodOf(checkout) === 'transfer' ? checkout.transfer : null;
  const deadline = holdDeadline(checkout.expires_at);
  const total = money(checkout.total, checkout.currency);

  return (
    <div className="space-y-8">
      <h1 className="flex items-center justify-center gap-4 text-center text-5xl sm:text-6xl">
        <span className="hidden size-14 shrink-0 items-center justify-center rounded-full bg-ink-3 text-ember sm:flex" aria-hidden="true">
          <ClockIcon size={26} />
        </span>
        Tu pedido está reservado
      </h1>

      {/* El plazo es lo más importante de la página: si se pasa, se pierde la reserva. */}
      <div role="note" aria-label="Plazo de la reserva" className="rounded-lg border border-ember/50 bg-ember/10 px-5 py-5 text-center sm:px-8 sm:py-6">
        <p className="leading-relaxed text-bone sm:text-lg">
          {deadline ? (
            <>
              Tenés tiempo hasta <strong className="whitespace-nowrap font-semibold text-white">{deadline}</strong>{' '}
            </>
          ) : (
            'Tenés unas horas '
          )}
          {transfer ? (
            <>
              para transferirnos <strong className="whitespace-nowrap font-semibold text-white tabular-nums">{total}</strong>.
            </>
          ) : (
            <>
              para pasar a retirarlo y pagar <strong className="whitespace-nowrap font-semibold text-white tabular-nums">{total}</strong> en efectivo.
            </>
          )}
        </p>
        <p className="mt-2 font-semibold text-ember-hi">
          {transfer ? 'Si no nos llega para entonces, se pierde tu reserva.' : 'Si no pasás para entonces, se pierde tu reserva.'}
        </p>
        {checkout.discount_code && (
          <p className="mt-2 text-sm text-moss">
            Ya tiene el código {checkout.discount_code.code}: te ahorrás <span className="tabular-nums">{money(checkout.discount_code.amount, checkout.currency)}</span>.
          </p>
        )}
        {checkout.discount && (
          <p className="mt-2 text-sm text-moss">
            Ya tiene el {percentText(checkout.discount.percent)} de descuento por pagar con {DISCOUNT_LABELS[paymentMethodOf(checkout)]}: te ahorrás{' '}
            <span className="tabular-nums">{money(checkout.discount.amount, checkout.currency)}</span>.
          </p>
        )}
      </div>

      {/* Con transferencia, en la compu: la cuenta a la izquierda y la entrega y los botones a la derecha, para verlo todo sin scrollear. */}
      <div className={transfer ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-8' : 'space-y-6'}>
        {transfer && (
          <TransferDetails transfer={transfer} total={checkout.total} currency={checkout.currency}>
            <p className="mt-3 text-sm text-mute">Cuando confirmemos la transferencia, el pedido pasa a preparación.</p>
          </TransferDetails>
        )}

        <div className="space-y-6">
          {checkout.delivery.kind === 'carrier' ? (
            <HomeDelivery delivery={checkout.delivery} currency={checkout.currency} />
          ) : (
            <Pickup note={transfer ? 'Podés retirarlo cuando confirmemos la transferencia.' : `Pagás ${total} en efectivo cuando lo retirás.`} />
          )}

          <div className={`flex flex-col gap-3 sm:flex-row ${transfer ? '' : 'justify-center'}`}>
            <button type="button" onClick={onCheck} className={button.primary}>
              {transfer ? 'Ya transferí, ver el estado' : 'Ver el estado del pedido'}
            </button>
            {signedIn && (
              <Link to={ACCOUNT_PATH} className={button.secondary}>
                Ver mis pedidos
              </Link>
            )}
          </div>
          {follow}
        </div>
      </div>
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
  const { restoreDelivery, clear, buyer: draft } = useCheckout();
  // Se toma al llegar, antes de que el checkout borre sus datos: con este email se ofrece entrar a Mis pedidos.
  const [buyer] = useState(() => rememberOrderBuyer(draft));

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
    // Pagado, o reservado por transferencia o efectivo: la compra está hecha y lo que se guardó para ella ya no hace falta.
    if (checkout.status === 'paid' || awaitsOfflinePayment(checkout)) clear();
    // No se pagó: al reintentar, el paso Envío arranca con la misma dirección y la vuelve a cotizar.
    if (checkout.status === 'failed' && checkout.delivery.kind === 'carrier' && checkout.delivery.address) restoreDelivery(checkout.delivery.address);
    // Sólo cuando llega la respuesta: clear y restoreDelivery cambian en cada render del provider.
  }, [checkout]);
  const offline = checkout != null && paysOffline(checkout);
  // El pedido por transferencia trae la cuenta: va en dos columnas, más ancho.
  const wide = checkout != null && awaitsOfflinePayment(checkout) && paymentMethodOf(checkout) === 'transfer';
  useTitle(
    checkout?.status === 'paid'
      ? 'Pedido confirmado'
      : checkout?.status === 'failed'
        ? offline
          ? 'El pedido se canceló'
          : 'El pago no se completó'
        : checkout && awaitsOfflinePayment(checkout)
          ? 'Pedido reservado'
          : 'Estado de tu pedido',
  );

  return (
    <div className={`${container} py-14 sm:py-20`}>
      <div className={`mx-auto ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
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
          {orderNumber(checkout) != null && (
            <p className="text-xl">
              Tu número de pedido es <strong className="font-display text-4xl tracking-wide text-ember-hi">#{orderNumber(checkout)}</strong>
            </p>
          )}
          <p className="text-mute">
            Pagaste {money(checkout.total, checkout.currency)}
            {checkout.delivery.kind === 'carrier' && `, con ${money(checkout.delivery.price, checkout.currency)} de envío`}. Te mandamos la confirmación por
            email.
          </p>
          {checkout.delivery.kind === 'carrier' ? <HomeDelivery delivery={checkout.delivery} currency={checkout.currency} /> : <Pickup />}
          {session.status === 'guest' && <FollowOrder buyer={buyer} what={checkout.delivery.kind === 'carrier' ? 'envío' : 'retiro'} />}
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
        </div>
      )}

      {checkout?.status === 'failed' && (
        <div className="space-y-6 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-alert/15 text-alert">
            <AlertIcon size={30} />
          </span>
          <h1 className="text-6xl">{offline ? 'El pedido se canceló' : 'El pago no se completó'}</h1>
          <p className="text-lg text-mute">
            {paymentMethodOf(checkout) === 'transfer'
              ? 'No recibimos la transferencia a tiempo o el local no pudo confirmarla, y se liberó la reserva.'
              : paymentMethodOf(checkout) === 'cash'
                ? 'Venció la reserva sin que lo retires, o el local lo canceló, y se liberó el stock.'
                : 'El pago fue rechazado o venció antes de terminarlo. No se te cobró nada y tu carrito sigue guardado.'}
          </p>
          {paymentMethodOf(checkout) === 'transfer' && (
            <p className="text-mute">
              ¿Ya habías transferido?{' '}
              <a href={whatsappUrl(messages.general)} target="_blank" rel="noopener noreferrer" className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi">
                Escribinos por WhatsApp
              </a>{' '}
              y lo resolvemos.
            </p>
          )}
          {/* Con transferencia o efectivo el carrito ya se soltó al reservar: no hay a qué volver, se arma de nuevo. */}
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {!offline && (
              <Link to="/checkout" className={button.primary}>
                Volver a intentar
              </Link>
            )}
            <Link to="/productos" className={offline ? button.primary : button.secondary}>
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
          <a href={whatsappUrl(messages.saleIssue(orderNumber(checkout)))} target="_blank" rel="noopener noreferrer" className={button.order}>
            <WhatsAppIcon /> Escribinos por WhatsApp
          </a>
        </div>
      )}

      {checkout && awaitsOfflinePayment(checkout) && <OfflinePending
          checkout={checkout}
          signedIn={signedIn}
          follow={session.status === 'guest' && <FollowOrder buyer={buyer} what={checkout.delivery.kind === 'carrier' ? 'envío' : 'retiro'} />}
          onCheck={() => void check()}
        />}

      {checkout && !['paid', 'failed', 'attention'].includes(checkout.status) && !awaitsOfflinePayment(checkout) && (
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
