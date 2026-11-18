import { shortDate } from '../lib/format';

/**
 * «Preventa · llegada estimada el 25 de diciembre» en las líneas del carrito y del pedido. Las líneas no traen la fecha:
 * sale del producto en el catálogo. `undated`: qué decir sin fecha; `null` deja solo «Preventa» (un pedido cuyo
 * producto ya no está en preventa).
 */
export function PresaleNote({ availableOn, undated = 'sin fecha estimada de llegada' }: { availableOn: string | null; undated?: string | null }) {
  const date = availableOn ? shortDate(availableOn, { long: true }) : null;
  const detail = date ? `llegada estimada el ${date}` : undated;
  return <span className="block text-sm font-semibold text-ember-hi">Preventa{detail && ` · ${detail}`}</span>;
}
