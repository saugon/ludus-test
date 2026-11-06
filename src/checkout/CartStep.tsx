import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { CartLines, cartBlocked } from '../components/CartLines';
import { ArrowLeftIcon } from '../components/Icons';
import { button } from '../components/ui';
import { useTitle } from '../lib/useTitle';
import { backLink, CheckoutFrame, STEP_PATHS, Summary } from './CheckoutFrame';

export function CartStep() {
  useTitle('Tu carrito');
  const cart = useCart();
  const navigate = useNavigate();
  const blocked = cartBlocked(cart.cart?.lines ?? [], cart.shortages);

  return (
    <CheckoutFrame
      step="cart"
      title="Tu carrito"
      aside={
        <Summary showItems={false} shippingRow="later">
          <button
            type="button"
            onClick={() => navigate(STEP_PATHS.shipping)}
            disabled={blocked || cart.saving}
            className={`${button.primaryCompact} w-full`}
          >
            Continuar al envío
          </button>
          {blocked && <p className="text-sm text-ember-hi">Corregí los productos marcados para seguir.</p>}
          <p className="text-xs text-mute">Retirá gratis en el local o pedí envío a domicilio en el paso siguiente.</p>
        </Summary>
      }
    >
      <CartLines compact />
      <Link to="/productos" className={backLink}>
        <ArrowLeftIcon size={16} /> Seguir comprando
      </Link>
    </CheckoutFrame>
  );
}
