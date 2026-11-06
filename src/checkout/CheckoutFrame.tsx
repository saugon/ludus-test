import { useEffect, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { itemCount } from '../cart/lines';
import { ErrorNotice } from '../components/ErrorNotice';
import { CheckIcon, ChevronRightIcon } from '../components/Icons';
import { ProductImage } from '../components/ProductImage';
import { button, container, sectionTitle } from '../components/ui';

export const backLink = 'inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-mute hover:text-bone';
import { money } from '../lib/format';
import { useProducts } from '../lib/storefront';
import { useCheckout } from './CheckoutProvider';

export type Step = 'cart' | 'shipping' | 'payment';

export const STEP_PATHS: Record<Step, string> = {
  cart: '/checkout',
  shipping: '/checkout/envio',
  payment: '/checkout/pago',
};

const STEPS: { step: Step; label: string }[] = [
  { step: 'cart', label: 'Carrito' },
  { step: 'shipping', label: 'Envío' },
  { step: 'payment', label: 'Pago' },
];

function Steps({ current }: { current: Step }) {
  const index = STEPS.findIndex((entry) => entry.step === current);

  return (
    <nav aria-label="Pasos de la compra">
      <ol className="flex flex-wrap items-center gap-x-2.5 font-ui text-sm font-bold uppercase tracking-[0.1em]">
        {STEPS.map((entry, position) => {
          const done = position < index;
          const active = position === index;
          const text = (
            <>
              {done ? <CheckIcon size={14} aria-hidden="true" /> : <span aria-hidden="true">{position + 1}</span>}
              {entry.label}
            </>
          );
          return (
            <li key={entry.step} className="flex items-center gap-2.5">
              {done ? (
                <Link to={STEP_PATHS[entry.step]} className="flex min-h-11 items-center gap-1.5 text-bone hover:text-ember-hi">
                  {text}
                </Link>
              ) : (
                <span aria-current={active ? 'step' : undefined} className={`flex min-h-11 items-center gap-1.5 ${active ? 'text-ember' : 'text-mute'}`}>
                  {text}
                </span>
              )}
              {position < STEPS.length - 1 && <ChevronRightIcon size={14} className="text-mute" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function EmptyCart() {
  const cart = useCart();
  return (
    <div className={`${container} py-20 text-center`}>
      <h1 className={sectionTitle}>Tu carrito está vacío</h1>
      <p className="mt-4 text-lg text-mute">Sumá productos para poder finalizar la compra.</p>
      {cart.error != null && <ErrorNotice error={cart.error} onRetry={() => void cart.reload()} className="mx-auto mt-6 max-w-lg text-left" />}
      <Link to="/productos" className={`${button.primary} mt-8`}>
        Ver productos
      </Link>
    </div>
  );
}

type FrameProps = {
  step: Step;
  title: string;
  aside: ReactNode;
  children: ReactNode;
  onSubmit?: (event: FormEvent) => void;
  // Mientras se va a pagar, el carrito se vacía del lado del servidor: no mostrar «Tu carrito está vacío».
  keepWhenEmpty?: boolean;
};

// Lo común a los tres pasos: carga el carrito, muestra los pasos y arma las dos columnas.
// Con onSubmit, las dos columnas son un solo formulario, así el botón del resumen lo envía.
export function CheckoutFrame({ step, title, aside, children, onSubmit, keepWhenEmpty = false }: FrameProps) {
  const cart = useCart();
  const { reload } = cart;

  useEffect(() => {
    void reload();
  }, [reload]);

  if (cart.status === 'loading' && !cart.cart) {
    return (
      <div className={`${container} py-20 text-center text-mute`} role="status">
        Cargando tu carrito…
      </div>
    );
  }

  if ((cart.cart?.lines.length ?? 0) === 0 && !keepWhenEmpty) return <EmptyCart />;

  // Los pasos y el título van en la columna izquierda, así el resumen arranca arriba de todo.
  const columns = (
    <>
      <div className="min-w-0">
        <Steps current={step} />
        <h1 className="font-ui text-3xl font-bold leading-tight text-white sm:text-4xl">{title}</h1>
        <div className="mt-5 space-y-5">{children}</div>
      </div>
      <aside aria-labelledby="resumen" className="lg:sticky lg:top-32 lg:mt-2.5 lg:self-start">
        {aside}
      </aside>
    </>
  );
  const grid = 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]';

  return (
    <div className={`${container} py-8 sm:py-10`}>
      {onSubmit ? (
        <form noValidate onSubmit={onSubmit} className={grid}>
          {columns}
        </form>
      ) : (
        <div className={grid}>{columns}</div>
      )}
    </div>
  );
}

type SummaryProps = {
  // En el carrito se editan las líneas a la izquierda; en los otros pasos, el resumen las lista.
  showItems: boolean;
  shippingRow: 'later' | 'chosen';
  children: ReactNode;
};

export function Summary({ showItems, shippingRow, children }: SummaryProps) {
  const cart = useCart();
  const { byCode } = useProducts();
  const { delivery, shipping, total } = useCheckout();
  const lines = cart.cart?.lines ?? [];
  const currency = cart.cart?.currency;

  let shippingLabel = 'Envío';
  let shippingValue = 'En el paso siguiente';
  if (shippingRow === 'chosen') {
    shippingLabel = delivery.method === 'pickup' ? 'Retiro en el local' : 'Envío a domicilio';
    shippingValue = delivery.method === 'pickup' ? 'Gratis' : shipping ? money(shipping.price, shipping.currency) : 'A cotizar';
  }

  return (
    <div className="rounded-lg bg-ink-2 p-5 ring-1 ring-line">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="resumen" className="font-ui text-2xl font-bold text-white">
          Tu pedido <span className="text-mute">({itemCount(cart.cart)})</span>
        </h2>
        {showItems && (
          <Link to={STEP_PATHS.cart} className="text-sm font-semibold text-mute underline underline-offset-4 hover:text-bone">
            Editar
          </Link>
        )}
      </div>

      {showItems && (
        <ul className="mt-3 space-y-3">
          {lines.map((line, index) => {
            const product = line.code ? byCode.get(line.code) : undefined;
            return (
              <li key={line.code ?? `line-${index}`} className="flex items-start gap-3">
                <ProductImage src={product?.image_url ?? null} alt="" className="size-12 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  {/* Los nombres largos (Battletome: …, Combat Patrol: …) se cortan en dos líneas; el title muestra el completo. */}
                  <span className="line-clamp-2 text-sm font-semibold leading-snug" title={line.name ?? line.code ?? 'Producto'}>
                    {line.name ?? line.code ?? 'Producto'}
                  </span>
                  <span className="mt-0.5 block text-xs text-mute tabular-nums">Cantidad: {line.quantity}</span>
                </span>
                <span className="shrink-0 text-sm leading-snug tabular-nums">{money(line.total, currency)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-mute">Productos</dt>
          <dd className="tabular-nums">{money(cart.cart?.total, currency)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-mute">{shippingLabel}</dt>
          <dd className={`shrink-0 tabular-nums ${shippingRow === 'later' ? 'text-mute' : ''}`}>{shippingValue}</dd>
        </div>
        <div className="mt-3! flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="text-mute">Total</dt>
          <dd className="font-ui text-3xl font-bold tabular-nums text-white">{money(shippingRow === 'chosen' ? total : cart.cart?.total, currency)}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2.5">{children}</div>
    </div>
  );
}
