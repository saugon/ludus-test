import { Link } from 'react-router-dom';
import { messages, store, whatsappUrl } from '../content';
import { NAV } from './Header';
import { InstagramIcon, WhatsAppIcon } from './Icons';
import { container } from './ui';

const columnTitle = 'mb-3 font-ui text-base font-bold tracking-normal text-ember-ink [-webkit-text-stroke:0]';
const columnText = 'font-ui font-medium text-ember-ink/75';

// Footer naranja: la dirección como título, los links y horarios en columnas y el nombre de la tienda en grande al pie.
export function Footer() {
  return (
    <footer className="bg-ember text-ember-ink">
      <div className={`${container} grid gap-10 pb-10 pt-12 sm:grid-cols-2 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,2.4fr))]`}>
        <div className="space-y-4">
          <p className="font-display text-5xl leading-none tracking-[0.01em] [-webkit-text-stroke:0.03em_currentColor] sm:text-6xl">{store.address}</p>
          <p className={`max-w-sm ${columnText}`}>Wargames, miniaturas y hobby. Una tienda y un lugar para jugar en {store.address}.</p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={whatsappUrl(messages.general)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink-0 px-5 font-ui font-bold text-white transition-colors hover:bg-ink-3"
            >
              <WhatsAppIcon size={18} className="text-moss" /> Escribinos por WhatsApp
            </a>
            <a
              href={store.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ember-ink/80 px-5 font-ui font-bold transition-colors hover:bg-ember-ink/10"
            >
              <InstagramIcon size={18} /> {store.instagram.handle}
            </a>
          </div>
          <a href={store.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-ui font-bold underline-offset-4 hover:underline">
            Cómo llegar <span aria-hidden="true">→</span>
          </a>
        </div>
        <div>
          <h2 className={columnTitle}>La tienda</h2>
          <ul className={`space-y-1.5 ${columnText}`}>
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-ember-ink hover:underline hover:underline-offset-4">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={columnTitle}>Horarios</h2>
          <dl className={`space-y-1.5 ${columnText}`}>
            {store.hours.map((slot) => (
              <div key={slot.days}>
                <dt className="inline">{slot.days}</dt> <span aria-hidden="true">·</span> <dd className="inline">{slot.time}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className={columnTitle}>Cómo comprar</h2>
          <p className={columnText}>Pagás online y retirás en el local.</p>
        </div>
      </div>
      <div className={`${container} pb-8`}>
        <div className="flex flex-col gap-4 border-t border-ember-ink/20 pt-6 lg:flex-row lg:items-end lg:justify-between">
          <p aria-hidden="true" className="font-display text-[clamp(3.25rem,12vw,8.5rem)] leading-[0.85] tracking-[0.005em] whitespace-nowrap [-webkit-text-stroke:0.03em_currentColor]">
            {store.name}
          </p>
          <p className="max-w-sm font-ui text-sm font-semibold lg:pb-3 lg:text-right">
            © {new Date().getFullYear()} {store.name}. Hecho en Argentina. Vendedor independiente, no afiliado a Games Workshop.
          </p>
        </div>
      </div>
    </footer>
  );
}
