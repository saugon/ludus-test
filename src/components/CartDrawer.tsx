import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { itemCount } from '../cart/lines';
import { store } from '../content';
import { money } from '../lib/format';
import { useOverlay } from '../lib/useOverlay';
import { CartLines, cartBlocked } from './CartLines';
import { CloseIcon, PinIcon } from './Icons';
import { button } from './ui';

export function CartDrawer() {
  const cart = useCart();
  const panel = useOverlay<HTMLDivElement>(cart.drawerOpen, cart.closeDrawer);
  const lines = cart.cart?.lines ?? [];
  const count = itemCount(cart.cart);
  const blocked = cartBlocked(lines, cart.shortages);

  if (!cart.drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/65" onClick={cart.closeDrawer} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-ink-2 shadow-2xl outline-none"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-title" className="text-3xl">
            Tu carrito {count > 0 && <span className="font-sans text-base text-mute">({count})</span>}
          </h2>
          <button type="button" onClick={cart.closeDrawer} data-autofocus className="flex size-11 items-center justify-center rounded-md hover:bg-ink-3" aria-label="Cerrar carrito">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          {cart.status === 'loading' && <p className="py-10 text-center text-mute">Cargando tu carrito…</p>}
          {cart.status !== 'loading' && lines.length === 0 && !cart.error && (
            <div className="space-y-4 py-12 text-center">
              <p className="text-lg">Tu carrito está vacío.</p>
              <Link to="/productos" onClick={cart.closeDrawer} className={button.secondary}>
                Ver productos
              </Link>
            </div>
          )}
          {(lines.length > 0 || cart.error != null) && (
            <div className="py-4">
              <CartLines onNavigate={cart.closeDrawer} compact />
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <footer className="space-y-4 border-t border-line px-5 py-5">
            <div className="flex items-baseline justify-between">
              <span className="text-mute">Total</span>
              <span className="text-2xl font-semibold tabular-nums" aria-live="polite">
                {money(cart.cart?.total, cart.cart?.currency)}
              </span>
            </div>
            <p className="flex items-start gap-2 text-sm text-mute">
              <PinIcon size={18} className="mt-0.5 shrink-0 text-ember" />
              Retirá gratis en el local, {store.address}, o pedí envío a domicilio.
            </p>
            {blocked ? (
              <p className="text-sm text-ember-hi">Corregí los productos marcados para seguir.</p>
            ) : null}
            <Link
              to="/checkout"
              onClick={(event) => {
                if (blocked || cart.saving) event.preventDefault();
                else cart.closeDrawer();
              }}
              aria-disabled={blocked || cart.saving}
              className={`${button.primary} w-full ${blocked || cart.saving ? 'pointer-events-none opacity-50' : ''}`}
            >
              Iniciar compra
            </Link>
          </footer>
        )}
      </div>
    </div>
  );
}
