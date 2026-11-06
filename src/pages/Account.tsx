import type { ShopperOrder } from '@vertex/storefront-sdk';
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNotice } from '../components/ErrorNotice';
import { withDelivery } from '../delivery/compat';
import { OrderDetail, OrderListItem, orderTitle } from '../components/OrderDetail';
import { button, container } from '../components/ui';
import { store } from '../content';
import { useStorefront } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';
import { describeOrder } from '../shopper/orderStatus';
import { firstName, isSessionError, useShopper } from '../shopper/ShopperProvider';
import { ACCOUNT_PATH, signInPath } from '../shopper/returnPath';

const PAGE_SIZE = 10;

type Orders = {
  orders: ShopperOrder[];
  cursor: string | null;
  status: 'loading' | 'ready' | 'more' | 'error';
  error: unknown;
};

function OrderSkeleton({ className = 'h-20' }: { className?: string }) {
  return <div className={`${className} animate-pulse rounded-lg bg-ink-2 ring-1 ring-line`} />;
}

// El pedido elegido va en ?pedido=, así el link se puede compartir y «atrás» vuelve al anterior.
function orderKey(order: ShopperOrder, index: number): string {
  return order.sale_number != null ? String(order.sale_number) : `sin-numero-${index}`;
}

function OrderList() {
  const { shopper: account } = useStorefront();
  const { expire } = useShopper();
  const [state, setState] = useState<Orders>({ orders: [], cursor: null, status: 'loading', error: null });
  const [params, setParams] = useSearchParams();
  const detail = useRef<HTMLElement>(null);
  const started = useRef(false);

  const load = useCallback(
    async (cursor: string | null) => {
      setState((previous) => ({ ...previous, status: cursor ? 'more' : 'loading', error: null }));
      try {
        const page = await account.orders({ limit: PAGE_SIZE, cursor });
        setState((previous) => ({
          orders: [...(cursor ? previous.orders : []), ...page.orders.map(withDelivery)],
          cursor: page.nextCursor,
          status: 'ready',
          error: null,
        }));
      } catch (error) {
        if (isSessionError(error)) {
          expire();
          return;
        }
        setState((previous) => ({ ...previous, status: 'error', error }));
      }
    },
    [account, expire],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load(null);
  }, [load]);

  const { orders, cursor, status, error } = state;

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Cargando tus pedidos" className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="space-y-3">
          <OrderSkeleton />
          <OrderSkeleton />
        </div>
        <OrderSkeleton className="h-96 max-lg:hidden" />
      </div>
    );
  }

  if (orders.length === 0 && status === 'error') {
    return <ErrorNotice error={error} onRetry={() => void load(null)} />;
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center">
        <p className="text-xl font-semibold">Todavía no tenés pedidos</p>
        <p className="mx-auto mt-2 max-w-md text-mute">
          Acá aparecen las compras que hagas con tu cuenta y las que pagaste con este email sin ingresar.
        </p>
        <Link to="/productos" className={`${button.primary} mt-6`}>
          Ver productos
        </Link>
      </div>
    );
  }

  const wanted = params.get('pedido');
  const selectedIndex = Math.max(0, orders.findIndex((order, index) => orderKey(order, index) === wanted));
  const selected = orders[selectedIndex];
  const count = `${orders.length}${cursor ? '+' : ''} ${orders.length === 1 && !cursor ? 'pedido' : 'pedidos'}`;

  function choose(event: MouseEvent, key: string) {
    event.preventDefault();
    setParams({ pedido: key });
    // En el celular el detalle está debajo de la lista: se baja hasta él.
    if (!window.matchMedia?.('(min-width: 1024px)').matches) {
      requestAnimationFrame(() => {
        detail.current?.scrollIntoView({ block: 'start' });
        detail.current?.focus({ preventScroll: true });
      });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-10">
      <nav aria-label="Tus pedidos" className="min-w-0">
        <p className="mb-3 px-1 font-ui text-sm font-semibold uppercase tracking-[0.1em] text-mute">{count}</p>
        <ul className="space-y-3">
          {orders.map((order, index) => {
            const key = orderKey(order, index);
            const isSelected = index === selectedIndex;
            return (
              <li key={key}>
                <Link
                  to={`?pedido=${encodeURIComponent(key)}`}
                  onClick={(event) => choose(event, key)}
                  aria-current={isSelected ? 'true' : undefined}
                  aria-label={`${orderTitle(order)}, ${describeOrder(order, store.address).label}`}
                  className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                >
                  <OrderListItem order={order} selected={isSelected} />
                </Link>
              </li>
            );
          })}
        </ul>
        {status === 'error' && <ErrorNotice error={error} onRetry={() => void load(cursor)} className="mt-3" />}
        {cursor && status !== 'error' && (
          <button type="button" onClick={() => void load(cursor)} disabled={status === 'more'} className={`${button.secondary} mt-3 w-full`}>
            {status === 'more' ? 'Cargando…' : 'Ver pedidos anteriores'}
          </button>
        )}
      </nav>
      <div className="min-w-0">
        <OrderDetail ref={detail} order={selected} />
      </div>
    </div>
  );
}

function Profile() {
  const session = useShopper();
  return (
    <div className="rounded-xl border border-line bg-ink-2 px-5 py-5 sm:px-8 sm:py-6">
      <dl className="grid gap-5 sm:grid-cols-2 sm:gap-8">
        <div className="min-w-0">
          <dt className="text-sm uppercase tracking-[0.14em] text-mute">Nombre</dt>
          <dd className="mt-1 text-lg">{session.shopper?.name ?? '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm uppercase tracking-[0.14em] text-mute">Email</dt>
          <dd className="mt-1 break-all text-lg">{session.shopper?.email ?? '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

type Tab = 'pedidos' | 'datos';

export function Account() {
  const session = useShopper();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('seccion') === 'datos' ? 'datos' : 'pedidos';
  useTitle(tab === 'datos' ? 'Mis datos' : 'Mis pedidos');
  const tabIds = { pedidos: useId(), datos: useId() };

  if (session.status === 'guest') return <Navigate to={signInPath(ACCOUNT_PATH)} replace />;

  if (session.status === 'loading') {
    return (
      <div className={`${container} py-20 text-center text-mute`} role="status">
        Revisando tu sesión…
      </div>
    );
  }

  const name = firstName(session.shopper);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'pedidos', label: 'Mis pedidos' },
    { id: 'datos', label: 'Mis datos' },
  ];

  return (
    <div className={`${container} py-8 sm:py-10`}>
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ember/15 font-ui text-xl font-bold text-ember">
          {(name || '?').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="font-sans text-xl font-semibold leading-tight tracking-normal [-webkit-text-stroke:0]">{name ? `Hola, ${name}` : 'Tu cuenta'}</h1>
          {session.shopper && <p className="break-all text-mute">{session.shopper.email}</p>}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="Tu cuenta" className="flex gap-6">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={tabIds[entry.id]}
              aria-selected={tab === entry.id}
              aria-controls={`${tabIds[entry.id]}-panel`}
              onClick={() => setParams(entry.id === 'datos' ? { seccion: 'datos' } : {})}
              className={`-mb-px border-b-2 pb-3 font-ui text-sm font-bold uppercase tracking-[0.12em] transition-colors ${
                tab === entry.id ? 'border-ember text-white' : 'border-transparent text-mute hover:text-bone'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            session.signOut();
            navigate('/');
          }}
          className="mb-2.5 text-sm text-mute underline underline-offset-4 hover:text-bone"
        >
          Cerrar sesión
        </button>
      </div>

      {session.status === 'error' && <ErrorNotice error={session.error} onRetry={() => void session.refresh()} className="mt-6" />}

      <div role="tabpanel" id={`${tabIds[tab]}-panel`} aria-labelledby={tabIds[tab]} className="mt-6">
        {tab === 'pedidos' ? <OrderList /> : <Profile />}
      </div>
    </div>
  );
}
