import type { Product } from '@vertex/storefront-sdk';
import { useEffect, useState } from 'react';
import { useCart } from '../cart/CartProvider';
import { quantityIn } from '../cart/lines';
import { CheckIcon, PlusIcon } from './Icons';
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

  if (atMax && look === 'card') {
    // En la tarjeta la frase no entra junto al precio: una pastilla con la frase para lectores; en columnas angostas, solo el tilde, del tamaño del «+».
    return (
      <p className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-soft bg-ink-0/70 px-3.5 @max-[12rem]:size-10 @max-[12rem]:justify-center @max-[12rem]:px-0 font-ui text-[0.9rem] font-semibold text-bone ${className}`}>
        <CheckIcon size={14} />
        <span aria-hidden="true" className="@max-[12rem]:hidden">En el carrito</span>
        <span className="sr-only">Ya tenés {inCart} en el carrito, el máximo disponible.</span>
      </p>
    );
  }

  if (look === 'card') {
    const name = product.name ?? product.code;
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'adding'}
        aria-label={
          state === 'added'
            ? `${name} agregado al carrito, tenés ${inCart}`
            : inCart > 0
              ? `Agregar otro ${name} al carrito, ya tenés ${inCart}`
              : `Agregar ${name} al carrito`
        }
        className={`${button.cardAdd} relative ${className}`}
      >
        {state === 'added' ? <CheckIcon size={18} strokeWidth={2.5} /> : <PlusIcon size={20} strokeWidth={2.5} />}
        {/* Cuántos hay en el carrito: queda a la vista después del tilde, que dura un momento. */}
        {inCart > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bone px-1 font-ui text-[0.7rem] font-bold leading-none tabular-nums text-ink ring-2 ring-ink-0"
          >
            {inCart}
          </span>
        )}
      </button>
    );
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
      className={`${button.primary} ${className}`}
    >
      {state === 'added' ? (
        <>
          <CheckIcon size={18} /> Agregado
        </>
      ) : state === 'adding' ? (
        'Agregando…'
      ) : (
        label
      )}
    </button>
  );
}
