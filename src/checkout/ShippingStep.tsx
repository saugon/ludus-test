import { useId, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { cartBlocked } from '../components/CartLines';
import { ArrowLeftIcon } from '../components/Icons';
import { button, field } from '../components/ui';
import { DeliveryChoice } from '../delivery/DeliveryChoice';
import { useTitle } from '../lib/useTitle';
import { useShopper } from '../shopper/ShopperProvider';
import { signInPath } from '../shopper/returnPath';
import { backLink, CheckoutFrame, STEP_PATHS, Summary } from './CheckoutFrame';
import { useCheckout } from './CheckoutProvider';

const input = field.replace('h-12', 'h-11');

function BuyerFields() {
  const session = useShopper();
  const { buyer, setBuyer, buyerTouched, touchBuyer, buyerErrors, member, checkingSession } = useCheckout();
  const ids = { name: useId(), email: useId() };

  if (checkingSession) {
    return (
      <p role="status" className="rounded-lg border border-line bg-ink-2 px-4 py-3.5 text-mute">
        Revisando tu sesión…
      </p>
    );
  }

  if (member) {
    const name = session.shopper?.name;
    return (
      <section
        aria-label={name ? `Comprás como ${name}` : 'Comprás con tu cuenta'}
        className="flex items-center gap-3 rounded-lg border border-line bg-ink-2 px-4 py-3.5"
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ember/15 font-ui font-bold text-ember">
          {(name ?? '?').trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate">
            <span className="font-semibold">{name ?? 'Tu cuenta'}</span>
            {session.shopper && <span className="text-mute"> · {session.shopper.email}</span>}
          </p>
          <p className="text-sm text-mute">Te mandamos la confirmación a este email.</p>
        </div>
        <button type="button" onClick={session.signOut} className="shrink-0 text-sm font-semibold text-mute underline underline-offset-4 hover:text-bone">
          No soy yo
        </button>
      </section>
    );
  }

  const nameError = buyerTouched.name ? buyerErrors.name : undefined;
  const emailError = buyerTouched.email ? buyerErrors.email : undefined;

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-lg font-semibold">Tus datos</legend>
      <p className="text-sm text-mute">
        ¿Tenés cuenta?{' '}
        <Link to={signInPath(STEP_PATHS.shipping)} className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi">
          Ingresá
        </Link>{' '}
        y no completes nada.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.name} className="mb-1.5 block text-sm text-bone/80">
            Nombre y apellido
          </label>
          <input
            id={ids.name}
            name="name"
            autoComplete="name"
            value={buyer.name}
            onChange={(event) => setBuyer({ ...buyer, name: event.target.value })}
            onBlur={() => touchBuyer('name')}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? `${ids.name}-error` : undefined}
            className={input}
          />
          {nameError && (
            <p id={`${ids.name}-error`} className="mt-1 text-xs text-alert">
              {nameError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={ids.email} className="mb-1.5 block text-sm text-bone/80">
            Email
          </label>
          <input
            id={ids.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={buyer.email}
            onChange={(event) => setBuyer({ ...buyer, email: event.target.value })}
            onBlur={() => touchBuyer('email')}
            aria-invalid={Boolean(emailError)}
            aria-describedby={`${ids.email}-hint${emailError ? ` ${ids.email}-error` : ''}`}
            className={input}
          />
          <p id={`${ids.email}-hint`} className="mt-1 text-xs text-mute">
            Te mandamos la confirmación y el número de pedido.
          </p>
          {emailError && (
            <p id={`${ids.email}-error`} className="mt-1 text-xs text-alert">
              {emailError}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

export function ShippingStep() {
  useTitle('Envío');
  const cart = useCart();
  const navigate = useNavigate();
  const checkout = useCheckout();
  const { delivery, shipping, member, touchBuyer, detailsComplete, checkingSession } = checkout;
  const blocked = cartBlocked(cart.cart?.lines ?? [], cart.shortages);

  function next(event: FormEvent) {
    event.preventDefault();
    if (blocked || checkingSession || !delivery.ready) return;
    if (!member) touchBuyer();
    if (shipping) delivery.touchContact();
    if (detailsComplete) {
      navigate(STEP_PATHS.payment);
      return;
    }

    // El botón está en el resumen (a la derecha, o al final en el celular): el dato que falta puede
    // estar fuera de la pantalla. Se lleva al primero, centrado para que se vea también su error.
    const missing = [
      !member && checkout.buyerErrors.name && 'name',
      !member && checkout.buyerErrors.email && 'email',
      shipping && delivery.contactErrors.phone && 'phone',
      shipping && delivery.contactErrors.document && 'document',
    ].find(Boolean);
    const field = missing ? (event.currentTarget as HTMLFormElement).elements.namedItem(missing) : null;
    if (field instanceof HTMLElement) {
      field.scrollIntoView({ block: 'center' });
      field.focus({ preventScroll: true });
    }
  }

  return (
    <CheckoutFrame
      step="shipping"
      title="Datos y envío"
      onSubmit={next}
      aside={
        <Summary showItems shippingRow="chosen">
          <button type="submit" disabled={blocked || cart.saving || checkingSession || !delivery.ready} className={`${button.primaryCompact} w-full`}>
            Continuar al pago
          </button>
          {blocked && (
            <p className="text-sm text-ember-hi">
              Hay productos para corregir.{' '}
              <Link to={STEP_PATHS.cart} className="font-semibold underline underline-offset-4">
                Volvé al carrito
              </Link>
              .
            </p>
          )}
          {!blocked && !delivery.ready && <p className="text-xs text-mute">Cotizá el envío y elegí una opción para seguir.</p>}
        </Summary>
      }
    >
      <BuyerFields />
      <DeliveryChoice delivery={delivery} disabled={false} />
      <Link to={STEP_PATHS.cart} className={backLink}>
        <ArrowLeftIcon size={16} /> Volver al carrito
      </Link>
    </CheckoutFrame>
  );
}
