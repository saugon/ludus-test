import { StorefrontError } from '@vertex/storefront-sdk';
import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { money } from '../lib/format';
import { useProducts } from '../lib/storefront';
import { ErrorNotice } from './ErrorNotice';
import { TrashIcon } from './Icons';
import { ProductImage } from './ProductImage';
import { QuantityStepper } from './QuantityStepper';

export function CartLines({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const cart = useCart();
  const { byCode } = useProducts();
  const lines = cart.cart?.lines ?? [];
  const names = Object.fromEntries(lines.flatMap((line) => (line.code ? [[line.code, line.name ?? line.code]] : [])));
  const closed = cart.error instanceof StorefrontError && cart.error.code === 'cart_closed';

  return (
    <div className="space-y-4">
      {cart.error != null && (
        <ErrorNotice error={cart.error} names={names} onRetry={() => void cart.reload()}>
          {closed && (
            <button type="button" onClick={cart.startNewCart} className="h-11 rounded-md bg-ember px-4 font-semibold text-ink">
              Empezar un carrito nuevo
            </button>
          )}
        </ErrorNotice>
      )}

      {cart.shortages.size > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ember/40 bg-ember/10 p-4">
          <p>Hay productos con menos stock del que pediste.</p>
          <button
            type="button"
            onClick={() => void cart.fixShortages()}
            disabled={cart.saving}
            className="h-11 rounded-md bg-ember px-4 font-semibold text-ink disabled:opacity-50"
          >
            Ajustar al stock disponible
          </button>
        </div>
      )}

      <ul className="divide-y divide-line">
        {lines.map((line, index) => {
          const code = line.code;
          const name = line.name ?? code ?? 'Producto';
          const product = code ? byCode.get(code) : undefined;
          const available = code ? cart.shortages.get(code) : undefined;
          const gone = line.status !== 'available' || line.max_quantity < 1;

          return (
            <li key={code ?? `line-${index}`} className="flex gap-4 py-4">
              <ProductImage src={product?.image_url ?? null} alt="" className={`${compact ? 'size-16' : 'size-20'} shrink-0 rounded-md`} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {code ? (
                      <Link to={`/productos/${encodeURIComponent(code)}`} onClick={onNavigate} className="font-semibold leading-snug hover:text-ember-hi">
                        {name}
                      </Link>
                    ) : (
                      <p className="font-semibold leading-snug">{name}</p>
                    )}
                    <p className="text-sm text-mute tabular-nums">{money(line.unit_price)} c/u</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{money(line.total)}</p>
                </div>

                {gone && (
                  <p className="text-sm text-alert">
                    {line.status === 'out_of_stock' ? 'Se agotó. Quitalo para seguir.' : 'Ya no está a la venta. Quitalo para seguir.'}
                  </p>
                )}
                {available !== undefined && !gone && (
                  <p className="text-sm text-ember-hi">
                    {available > 0 ? `Quedan ${available}.` : 'Se agotó.'}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  {code && !gone ? (
                    <QuantityStepper
                      label={`Cantidad de ${name}`}
                      value={line.quantity}
                      max={Math.max(line.max_quantity, 1)}
                      disabled={cart.saving}
                      onChange={(quantity) => void cart.setQuantity(code, quantity)}
                    />
                  ) : (
                    <span className="text-sm text-mute">Cantidad: {line.quantity}</span>
                  )}
                  {code && (
                    <button
                      type="button"
                      onClick={() => void cart.remove(code)}
                      disabled={cart.saving}
                      className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-mute hover:text-alert disabled:opacity-50"
                      aria-label={`Quitar ${name}`}
                    >
                      <TrashIcon size={18} /> <span className="text-sm">Quitar</span>
                    </button>
                  )}
                </div>
                {code && !gone && line.quantity >= line.max_quantity && (
                  <p className="text-sm text-mute">Máximo disponible: {line.max_quantity}.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function cartBlocked(lines: { status: string; max_quantity: number }[], shortages: Map<string, number>): boolean {
  return shortages.size > 0 || lines.some((line) => line.status !== 'available' || line.max_quantity < 1);
}
