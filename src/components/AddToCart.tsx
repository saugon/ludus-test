import type { Product } from '@vertex/storefront-sdk';
import { useEffect, useState } from 'react';
import { useCart } from '../cart/CartProvider';
import { quantityIn } from '../cart/lines';
import { CheckIcon } from './Icons';
import { button } from './ui';

type Props = {
  product: Product;
  quantity?: number;
  className?: string;
  label?: string;
  openCart?: boolean;
  /** `card`: la pastilla de las tarjetas de producto. */
  look?: 'default' | 'card';
};

export function AddToCart({ product, quantity = 1, className = '', label = 'Agregar', openCart = false, look = 'default' }: Props) {
  const cart = useCart();
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const inCart = quantityIn(cart.cart, product.code);
  const atMax = inCart >= product.max_quantity;

  useEffect(() => {
    if (state !== 'added') return;
    const timer = setTimeout(() => setState('idle'), 1800);
    return () => clearTimeout(timer);
  }, [state]);

  async function handleClick() {
    setState('adding');
    const ok = await cart.add(product, quantity);
    setState(ok ? 'added' : 'idle');
    if (ok && openCart) cart.openDrawer();
  }

  if (atMax) {
    return (
      <p className={`text-sm text-mute ${className}`}>
        Ya tenés {inCart} en el carrito, el máximo disponible.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'adding'}
      aria-live="polite"
      className={`${look === 'card' ? button.cardAdd : button.primary} ${className}`}
    >
      {state === 'added' ? (
        <>
          <CheckIcon size={look === 'default' ? 18 : 14} /> Agregado
        </>
      ) : state === 'adding' ? (
        'Agregando…'
      ) : (
        label
      )}
    </button>
  );
}
