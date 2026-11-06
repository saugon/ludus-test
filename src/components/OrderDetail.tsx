import type { ShopperOrder } from '@vertex/storefront-sdk';
import { forwardRef } from 'react';
import { messages, store, whatsappUrl } from '../content';
import { addAmounts, formatAddress } from '../delivery/address';
import { money } from '../lib/format';
import { useProducts } from '../lib/storefront';
import { describeOrder, orderDate, orderDay, orderProgress, shipmentLabel, type Tone } from '../shopper/orderStatus';
import { ProductImage } from './ProductImage';

const DOTS: Record<Tone, string> = {
  ready: 'bg-moss',
  progress: 'bg-ember',
  done: 'bg-mute',
  problem: 'bg-alert',
};

const TONE_TEXT: Record<Tone, string> = {
  ready: 'text-moss',
  progress: 'text-bone',
  done: 'text-bone',
  problem: 'text-alert',
};

const sectionLabel = 'font-ui text-sm font-semibold uppercase tracking-[0.1em] text-mute';

export function orderTitle(order: ShopperOrder): string {
  return order.sale_number != null ? `Pedido #${order.sale_number}` : 'Pedido sin número';
}

// La fila de la lista de la izquierda.
export function OrderListItem({ order, selected }: { order: ShopperOrder; selected: boolean }) {
  const view = describeOrder(order, store.address);
  return (
    <span
      className={`block rounded-lg border px-4 py-3.5 transition-colors ${selected ? 'border-mute bg-ink-3' : 'border-line bg-ink-2 hover:border-mute'}`}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{orderTitle(order)}</span>
        <span className="tabular-nums">{money(order.total, order.currency)}</span>
      </span>
      <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-mute">
        <span>
          {orderDay(order.created_at)} · {order.delivery.kind === 'carrier' ? 'Envío' : 'Retiro'}
        </span>
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${DOTS[view.tone]}`} aria-hidden="true" />
          {view.label}
        </span>
      </span>
    </span>
  );
}

function Progress({ order }: { order: ShopperOrder }) {
  const progress = orderProgress(order);
  if (!progress) return null;
  return (
    <ol aria-label="Estado del pedido" className="mt-5 grid grid-cols-4 gap-2">
      {progress.steps.map((step, index) => {
        const reached = index <= progress.current;
        const current = index === progress.current;
        return (
          <li key={step} aria-current={current ? 'step' : undefined} className="min-w-0">
            <span className={`block h-1 rounded-full ${reached ? 'bg-ember' : 'bg-line'}`} aria-hidden="true" />
            <span className={`mt-2.5 block text-sm leading-snug ${current ? 'font-semibold text-white' : reached ? 'text-bone' : 'text-mute'}`}>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Delivery({ order }: { order: ShopperOrder }) {
  const delivery = order.delivery;

  if (delivery.kind === 'carrier') {
    const shipment = shipmentLabel(delivery.status);
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className={sectionLabel}>Envío a</p>
          <p className="mt-2">{delivery.address ? formatAddress(delivery.address) : 'Tu domicilio'}</p>
          <p className="mt-1 text-sm text-mute">{delivery.name}</p>
        </div>
        <div>
          <p className={sectionLabel}>Seguimiento</p>
          {shipment && <p className="mt-2">{shipment}</p>}
          {delivery.tracking_number && <p className="mt-1 text-sm text-mute tabular-nums">N.º {delivery.tracking_number}</p>}
          {delivery.tracking_url && (
            <a href={delivery.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-ember underline underline-offset-4 hover:text-ember-hi">
              Seguir envío <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <p className={sectionLabel}>Retiro en</p>
        <p className="mt-2">{store.address}</p>
        <a href={store.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-ember underline underline-offset-4 hover:text-ember-hi">
          Cómo llegar <span aria-hidden="true">→</span>
        </a>
      </div>
      <div>
        <p className={sectionLabel}>Horarios</p>
        <ul className="mt-2 space-y-1">
          {store.hours.map((slot) => (
            <li key={slot.days}>
              {slot.days} · {slot.time}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// El detalle del pedido elegido, a la derecha (o debajo de la lista en el celular).
export const OrderDetail = forwardRef<HTMLElement, { order: ShopperOrder }>(function OrderDetail({ order }, ref) {
  const { byCode } = useProducts();
  const view = describeOrder(order, store.address);
  const progress = orderProgress(order);
  const units = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const products = order.lines.reduce<string | null>((sum, line) => addAmounts(sum, line.total), '0');
  const title = orderTitle(order);
  const carrier = order.delivery.kind === 'carrier';

  return (
    <article ref={ref} aria-label={title} tabIndex={-1} className="scroll-mt-32 rounded-lg border border-line bg-ink-2 outline-none">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-line p-5 sm:p-6">
        <div>
          <h2 className="text-4xl">{title}</h2>
          <p className="mt-1.5 text-mute">
            {orderDate(order.created_at)} · {units} {units === 1 ? 'producto' : 'productos'}
          </p>
        </div>
        <a
          href={whatsappUrl(messages.saleIssue(order.sale_number))}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-mute underline underline-offset-4 hover:text-bone"
        >
          ¿Problemas con el pedido?
        </a>
      </header>

      <section aria-label="Estado" className="border-b border-line p-5 sm:p-6">
        {!progress && (
          <p className={`flex items-center gap-2 font-semibold ${TONE_TEXT[view.tone]}`}>
            <span className={`size-2 rounded-full ${DOTS[view.tone]}`} aria-hidden="true" />
            {view.label}
          </p>
        )}
        <p className={progress ? 'text-lg font-semibold' : 'mt-1.5 text-mute'}>{view.hint}</p>
        <Progress order={order} />
      </section>

      <section aria-label="Entrega" className="border-b border-line p-5 sm:p-6">
        <Delivery order={order} />
      </section>

      <section aria-label="Productos" className="p-5 sm:p-6">
        <ul className="space-y-4">
          {order.lines.map((line, index) => {
            const product = byCode.get(line.code);
            return (
              <li key={`${line.code}-${index}`} className="flex items-center gap-4">
                <ProductImage src={product?.image_url ?? null} alt="" className="size-14 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{line.name}</span>
                  <span className="block text-sm text-mute tabular-nums">
                    Cantidad: {line.quantity}
                    {line.quantity > 1 && ` · ${money(line.unit_price, order.currency)} c/u`}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{money(line.total, order.currency)}</span>
              </li>
            );
          })}
        </ul>
        <dl className="mt-5 space-y-1.5 border-t border-line pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-mute">Productos</dt>
            <dd className="tabular-nums">{money(products, order.currency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-mute">{carrier ? 'Envío a domicilio' : 'Retiro en el local'}</dt>
            <dd className="tabular-nums">{carrier ? money(order.delivery.price, order.currency) : 'Gratis'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-2">
            <dt className="text-mute">Total</dt>
            <dd className="font-ui text-3xl font-bold tabular-nums text-white">{money(order.total, order.currency)}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
});
