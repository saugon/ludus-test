import type { Product } from '@vertex/storefront-sdk';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { quantityIn } from '../cart/lines';
import { AddToCart } from '../components/AddToCart';
import { ErrorNotice } from '../components/ErrorNotice';
import { CheckIcon, PinIcon, WhatsAppIcon } from '../components/Icons';
import { ZoomableImage } from '../components/ZoomableImage';
import { QuantityStepper } from '../components/QuantityStepper';
import { button, container } from '../components/ui';
import { messages, store, whatsappUrl } from '../content';
import { isNotFound } from '../lib/errors';
import { money } from '../lib/format';
import { isOrderable, useProducts, useStorefront } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';

type State = { status: 'loading' | 'ready' | 'error'; product: Product | null; error: unknown };

export function ProductDetail() {
  const { code = '' } = useParams();
  const storefront = useStorefront();
  const { byCode } = useProducts();
  const cached = byCode.get(code) ?? null;
  const [state, setState] = useState<State>({ status: cached ? 'ready' : 'loading', product: cached, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    storefront.getProduct(code).then(
      (product) => active && setState({ status: 'ready', product, error: null }),
      (error: unknown) => active && setState((previous) => ({ status: 'error', product: previous.product, error })),
    );
    return () => {
      active = false;
    };
  }, [storefront, code, attempt]);

  const product = state.product;
  useTitle(product?.name ?? (state.status === 'error' && isNotFound(state.error) ? 'Producto no encontrado' : undefined));

  if (state.status === 'error' && isNotFound(state.error)) {
    return (
      <div className={`${container} py-20 text-center`}>
        <h1 className="text-6xl">Producto no encontrado</h1>
        <p className="mt-4 text-lg text-mute">Este producto no existe o ya no está publicado en la tienda.</p>
        <Link to="/productos" className={`${button.primary} mt-8`}>
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className={`${container} py-8 sm:py-12`}>
      <nav aria-label="Ruta" className="mb-6 text-mute">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link to="/productos" className="hover:text-bone">
              Productos
            </Link>
          </li>
          {product?.category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link to={`/productos?categoria=${encodeURIComponent(product.category)}`} className="hover:text-bone">
                  {product.category}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      {state.status === 'error' && !product && <ErrorNotice error={state.error} onRetry={() => setAttempt((value) => value + 1)} />}

      {state.status === 'loading' && !product && (
        <div className="grid gap-8 lg:grid-cols-2" aria-hidden="true">
          <div className="aspect-square animate-pulse rounded-lg bg-ink-2" />
          <div className="space-y-4">
            <div className="h-14 w-3/4 animate-pulse rounded bg-ink-2" />
            <div className="h-8 w-1/3 animate-pulse rounded bg-ink-2" />
            <div className="h-24 animate-pulse rounded bg-ink-2" />
          </div>
          <p role="status" className="sr-only">
            Cargando producto
          </p>
        </div>
      )}

      {product && <ProductView product={product} />}
    </div>
  );
}

function ProductView({ product }: { product: Product }) {
  const cart = useCart();
  const name = product.name ?? product.code;
  const orderable = isOrderable(product);
  const inCart = quantityIn(cart.cart, product.code);
  const room = Math.max(product.max_quantity - inCart, 0);
  const [quantity, setQuantity] = useState(1);
  const amount = Math.min(Math.max(quantity, 1), Math.max(room, 1));

  return (
    <article className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      {/* En desktop la foto queda fija debajo del navbar (4.5rem) mientras se lee una descripción larga. */}
      <ZoomableImage src={product.image_url} alt={name} className="aspect-square w-full rounded-lg lg:sticky lg:top-24 lg:self-start" />
      <div className="space-y-6">
        <div>
          <h1 className="text-5xl sm:text-6xl">{name}</h1>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {money(product.price, product.currency)}
            {!orderable && <span className="ml-2 font-sans text-base font-normal text-mute">Precio de referencia</span>}
          </p>
        </div>

        {orderable ? (
          <>
            <p className="flex items-center gap-2 text-bone/90">
              <CheckIcon size={18} className="text-ember" />
              {product.max_quantity <= 5 ? `En stock: quedan ${product.max_quantity}` : 'En stock'}
            </p>
            {room > 0 ? (
              <div className="flex items-center gap-3">
                <QuantityStepper label="Cantidad" value={amount} max={room} onChange={setQuantity} />
                <AddToCart
                  product={product}
                  quantity={amount}
                  label="Agregar al carrito"
                  openCart
                  className="h-12 min-w-0 flex-1 sm:max-w-xs"
                />
              </div>
            ) : (
              <p className="text-mute">
                Ya tenés {inCart} en el carrito, el máximo disponible.{' '}
                <button type="button" onClick={cart.openDrawer} className="font-semibold text-ember-hi underline underline-offset-4">
                  Ver carrito
                </button>
              </p>
            )}
            {inCart > 0 && room > 0 && <p className="text-sm text-mute">Ya tenés {inCart} en el carrito.</p>}
          </>
        ) : (
          <div className="space-y-3 rounded-lg border border-moss/30 bg-moss/5 p-5">
            <p className="text-lg font-semibold text-moss">Sin stock. Te lo conseguimos por encargo.</p>
            <p className="text-mute">Escribinos y te confirmamos precio y demora antes de traerlo.</p>
            <a href={whatsappUrl(messages.product(name))} target="_blank" rel="noopener noreferrer" className={button.order}>
              <WhatsAppIcon /> Consultar por WhatsApp
            </a>
          </div>
        )}

        <p className="flex items-start gap-2 text-mute">
          <PinIcon size={20} className="mt-0.5 shrink-0 text-ember" />
          Retiro en el local, {store.address}.
        </p>

        {product.description && (
          <div className="border-t border-line pt-6">
            <h2 className="font-sans text-lg font-semibold tracking-normal">Descripción</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-bone/85">{product.description}</p>
          </div>
        )}
      </div>
    </article>
  );
}
