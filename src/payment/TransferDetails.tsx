import type { CheckoutTransfer } from '@vertex/storefront-sdk';
import { useState, type ReactNode } from 'react';
import { WhatsAppIcon } from '../components/Icons';
import { button } from '../components/ui';
import { messages, whatsappUrl } from '../content';
import { money } from '../lib/format';
import { ACCOUNT_LABELS } from './methods';

// Un dato de la cuenta con su botón para copiarlo, que es lo que se pega en la app del banco.
function CopyValue({ label, value, shown = value }: { label: string; value: string; shown?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <dt className="text-sm text-mute">{label}</dt>
        <dd className="break-all font-semibold tabular-nums text-bone">{shown}</dd>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copiar ${label.toLowerCase()}`}
        className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-bone hover:border-mute"
      >
        <span aria-live="polite">{copied ? 'Copiado' : 'Copiar'}</span>
      </button>
    </div>
  );
}

function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="break-words font-semibold text-bone">{value}</dd>
    </div>
  );
}

// La cuenta del local a la que transferir, con el monto y el botón para mandar el comprobante.
export function TransferDetails({
  transfer,
  total,
  currency,
  children,
}: {
  transfer: CheckoutTransfer;
  total: string;
  currency: string;
  children?: ReactNode;
}) {
  const shownTotal = money(total, currency);
  return (
    <section aria-labelledby="transferencia-titulo" className="rounded-lg border border-line bg-ink-2 p-5 text-left sm:p-6">
      <h2 id="transferencia-titulo" className="font-ui text-sm font-semibold uppercase tracking-[0.1em] text-mute [-webkit-text-stroke:0]">
        Datos para transferir
      </h2>
      <dl className="mt-2 divide-y divide-line">
        <CopyValue label={ACCOUNT_LABELS[transfer.account_type]} value={transfer.account_value} />
        <CopyValue label="Monto" value={total.replace(/\.00$/, '')} shown={shownTotal} />
      </dl>
      {/* Lo que no se copia va en una sola fila: sirve para chequear que la cuenta es la del local. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-line py-3.5 sm:grid-cols-3">
        <Detail label="Titular" value={transfer.holder} className="col-span-2 sm:col-span-1" />
        <Detail label="CUIT" value={transfer.cuit} />
        <Detail label="Banco" value={transfer.bank} />
      </dl>
      <a href={whatsappUrl(messages.transferReceipt(shownTotal))} target="_blank" rel="noopener noreferrer" className={`${button.order} mt-5 w-full sm:w-auto`}>
        <WhatsAppIcon /> Mandanos el comprobante
      </a>
      {children}
    </section>
  );
}
