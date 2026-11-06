import type { Product } from '@vertex/storefront-sdk';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ANNOUNCEMENTS } from '../components/AnnouncementBar';
import { Carousel } from '../components/Carousel';
import { ErrorNotice } from '../components/ErrorNotice';
import { ClockIcon, InstagramIcon, PinIcon, WhatsAppIcon } from '../components/Icons';
import { SearchForm } from '../components/SearchForm';
import { ShowcaseEncargoCard, ShowcaseProductCard } from '../components/ShowcaseCard';
import { LoadingLabel } from '../components/Skeletons';
import { container, sectionTitle } from '../components/ui';
import { messages, store, whatsappUrl } from '../content';
import { categoriesOf, normalize } from '../lib/search';
import { isOrderable, useProducts } from '../lib/storefront';
import { useTitle } from '../lib/useTitle';
import { asset } from '../lib/paths';

function featured(products: Product[]): Product[] {
  const available = products.filter(isOrderable);
  const picked = store.featuredCodes.flatMap((code) => available.filter((product) => product.code === code));
  return (picked.length > 0 ? picked : available).slice(0, store.featuredCount);
}

const street = store.address.split(',')[0];

// Títulos grandes en Bebas Neue, en mayúsculas, como "RESERVÁ TU MESA."
const poster = 'uppercase tracking-[0.01em] text-white';
const arrowLink = 'inline-flex items-center gap-1.5 font-ui font-semibold text-ember transition-colors hover:text-ember-hi';

function SectionHeading({ id, title, subtitle, action }: { id: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className={`${container} mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 sm:mb-9`}>
      <h2 id={id} className={sectionTitle}>
        {title}
        {subtitle && <span className="block text-bone/55">{subtitle}</span>}
      </h2>
      {action}
    </div>
  );
}

// Alto del primer pantallazo: la pantalla menos la barra de anuncios (2rem), así la franja de promesas entra entera.
const heroHeight = 'min-h-[min(100svh,48rem)] sm:min-h-[44rem] lg:min-h-[max(40rem,min(calc(100svh-2rem),60rem))]';
const heroCta = 'inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-7 font-ui text-lg font-bold transition-[background-color,box-shadow,transform] active:translate-y-px';

function Hero() {
  return (
    // Sube por debajo del navbar, que en la home arranca transparente.
    <section aria-labelledby="hero-title" className={`relative isolate -mt-16 flex flex-col overflow-hidden bg-ink-0 lg:-mt-[4.5rem] ${heroHeight}`}>
      <img
        src={asset('/img/hero-1024.webp')}
        srcSet={asset('/img/hero-640.webp 640w, /img/hero-1024.webp 1024w, /img/hero-1600.webp 1600w')}
        sizes="100vw"
        alt="Miniatura de un Space Marine pintada a mano"
        width={1600}
        height={900}
        fetchPriority="high"
        className="absolute inset-0 -z-10 size-full object-cover object-[52%_18%] sm:object-[62%_25%] lg:object-[70%_30%]"
      />
      {/* Contraste del texto: en mobile, de abajo hacia arriba; en desktop, un degradado diagonal que oscurece la
          esquina inferior izquierda (donde está el texto) y deja limpio al marine. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-0 from-25% via-ink-0/50 via-55% to-transparent lg:bg-[linear-gradient(35deg,rgba(6,7,16,0.94)_0%,rgba(6,7,16,0.78)_28%,rgba(6,7,16,0.35)_50%,transparent_68%)]"
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-ink-0/70 to-transparent" />

      <div className={`${container} flex flex-1 flex-col justify-end pb-8 pt-28 lg:justify-start lg:pt-32`}>
        <div className="max-w-xl lg:my-auto">
          <h1
            id="hero-title"
            className="text-[clamp(4rem,12vw,7.5rem)] uppercase leading-[0.92] tracking-[0.01em] text-white lg:text-[clamp(5rem,min(8vw,13vh),7.5rem)]"
          >
            <span className="block">Armá tu</span> <span className="block text-ember">ejército.</span>
          </h1>
          <p className="mt-5 max-w-md font-ui text-lg font-medium leading-snug text-bone [text-shadow:0_1px_14px_rgba(0,0,0,0.65)] sm:text-xl">
            Miniaturas, pinturas y todo lo que necesitás para Warhammer 40.000, Age of Sigmar y más. Comprá online y retiralo en
            el local.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/productos"
              className={`${heroCta} bg-ember text-ember-ink shadow-[0_6px_28px_rgba(245,106,45,0.5)] hover:bg-ember-hi hover:shadow-[0_8px_36px_rgba(245,106,45,0.65)] active:bg-ember-lo`}
            >
              Ver productos <span aria-hidden="true">→</span>
            </Link>
            <a
              href={whatsappUrl(messages.order)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${heroCta} border border-white/25 bg-white/10 text-white backdrop-blur-md hover:border-white/45 hover:bg-white/18`}
            >
              <WhatsAppIcon className="text-moss" /> Hacenos tu encargo
            </a>
          </div>
          <SearchForm size="lg" className="mt-6 lg:hidden" />
        </div>
        <a href="#jugar" className="group mt-10 flex w-fit items-center gap-3 font-ui text-sm leading-tight text-bone/75 hover:text-bone">
          <img src={asset('/img/local-400.webp')} alt="" width={44} height={44} loading="lazy" decoding="async" className="size-11 rounded-md object-cover ring-1 ring-white/15" />
          <span>
            Una tarde cualquiera
            <br />
            en {street}
          </span>
        </a>
      </div>
      <Promises />
    </section>
  );
}

// Va al pie del hero, dentro del primer pantallazo. En mobile no se muestra: la barra de anuncios ya rota los mismos mensajes.
function Promises() {
  return (
    <div className="hidden border-y border-line-soft bg-ink-2/90 backdrop-blur-md sm:block">
      <ul className={`${container} grid grid-cols-3`}>
        {ANNOUNCEMENTS.map((item, index) => (
          <li
            key={item.text}
            className={`flex items-center justify-center px-3 py-4 text-center font-ui text-xs font-bold uppercase tracking-[0.16em] text-dim lg:whitespace-nowrap lg:text-sm ${index > 0 ? 'border-l border-line-soft' : ''}`}
          >
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Featured() {
  const { status, products, error, reload } = useProducts();
  const items = featured(products);
  const cardWidth = 'w-[78vw] shrink-0 snap-start sm:w-[42vw] lg:w-[min(28vw,24.5rem)]';

  return (
    <section aria-labelledby="destacados-title" className="py-16 sm:py-24">
      <SectionHeading
        id="destacados-title"
        title="Destacados."
        subtitle="En stock y listo para llevártelo hoy."
        action={
          <Link to="/productos" className={arrowLink}>
            Ver todos los productos <span aria-hidden="true">→</span>
          </Link>
        }
      />
      {status === 'error' && items.length === 0 ? (
        <div className={container}>
          <ErrorNotice error={error} onRetry={reload} />
        </div>
      ) : status === 'loading' && items.length === 0 ? (
        <div className="bleed-row flex gap-4 overflow-hidden">
          <LoadingLabel>Cargando productos</LoadingLabel>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} aria-hidden="true" className={`${cardWidth} stripes aspect-[4/5] animate-pulse rounded-xl bg-ink-3`} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className={`${container} text-mute`}>Estamos cargando el stock. Mientras tanto, mirá los encargos o escribinos.</p>
      ) : (
        <Carousel label="Productos destacados">
          {items.map((product) => (
            <ShowcaseProductCard key={product.code} product={product} className={cardWidth} />
          ))}
        </Carousel>
      )}
    </section>
  );
}

function PlayAtTheStore() {
  const card = 'relative isolate flex shrink-0 snap-start flex-col overflow-hidden rounded-xl p-5 sm:p-6';
  const big = 'h-[28rem] w-[84vw] sm:h-[30rem] sm:w-[60vw] lg:h-[33rem] lg:w-[min(44vw,38rem)]';
  const ghostPill = 'inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full bg-white/12 px-4 font-ui text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/22';

  return (
    <section id="jugar" aria-labelledby="jugar-title" className="bg-ink-0 py-16 sm:py-24">
      <div className={`${container} mb-8 grid gap-4 sm:mb-10 lg:grid-cols-2 lg:items-center`}>
        <h2 id="jugar-title" className={sectionTitle}>
          Vení a jugar
          <br />
          al local.
        </h2>
        <p className="max-w-[38rem] font-ui text-xl leading-snug text-bone/85 lg:justify-self-end lg:text-right lg:text-[1.375rem]">
          Ludus no es solo una tienda. Tenemos {store.tables} mesas para que juegues tus partidas. Traé a tu grupo o encontrá con
          quién jugar.
        </p>
      </div>
      <Carousel label="Jugar en el local">
        <article className={`${card} ${big} justify-end`}>
          <img
            src={asset('/img/local-513.webp')}
            srcSet={asset('/img/local-400.webp 400w, /img/local-513.webp 513w')}
            sizes="(min-width: 1024px) 38rem, 84vw"
            alt="Jugadores en las mesas del local de Ludus, con miniaturas y escenografía"
            width={513}
            height={739}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-0/90 from-15% via-ink-0/40 via-45% to-transparent" />
          <h3 className={`${poster} text-5xl sm:text-6xl`}>Reservá tu mesa.</h3>
          <p className="mt-3 max-w-sm font-ui text-base leading-snug text-bone/75 sm:text-lg">Decinos qué día venís y para cuántos jugadores y te la dejamos lista.</p>
          <a href={whatsappUrl(messages.table)} target="_blank" rel="noopener noreferrer" className={`${ghostPill} mt-5`}>
            Reservar por WhatsApp <span aria-hidden="true">→</span>
          </a>
        </article>
        <article className={`${card} ${big} stripes justify-end bg-ink-3`}>
          <h3 className={`${poster} text-5xl sm:text-6xl`}>Torneos y ligas.</h3>
          <p className="mt-3 max-w-md font-ui text-base leading-snug text-bone/75 sm:text-lg">{store.tournaments}</p>
          <a href={store.instagram.url} target="_blank" rel="noopener noreferrer" className={`${ghostPill} mt-5`}>
            Ver fechas en Instagram <span aria-hidden="true">→</span>
          </a>
        </article>
        <article className={`${card} h-[28rem] w-[64vw] justify-between bg-ember text-ember-ink sm:h-[30rem] sm:w-[34vw] lg:h-[33rem] lg:w-[min(22vw,19rem)]`}>
          <p className="font-ui text-sm font-bold uppercase tracking-[0.18em]">{street}</p>
          <p>
            <span className="block font-display text-[9rem] leading-[0.8]">{store.tables}</span>
            <span className="mt-2 block font-ui text-xl font-bold leading-tight">mesas para jugar</span>
          </p>
        </article>
      </Carousel>
    </section>
  );
}

function Encargos() {
  const { products, status } = useProducts();
  const items = products.filter((product) => !isOrderable(product));
  const shown = items.slice(0, 6);

  return (
    <section id="encargos" aria-labelledby="encargos-title" className="py-16 sm:py-24">
      <SectionHeading
        id="encargos-title"
        title="Por encargo."
        subtitle="Lo que no tenemos hoy, te lo conseguimos."
        action={
          items.length > 0 && (
            <Link to="/productos?estado=encargo" className="inline-flex items-center gap-1.5 font-ui font-semibold text-moss transition-colors hover:text-[#5fe0ad]">
              Ver todos los productos por encargo <span aria-hidden="true">→</span>
            </Link>
          )
        }
      />
      <div className={`${container} grid gap-4 lg:grid-cols-[minmax(0,9fr)_minmax(0,15fr)]`}>
        <div className="flex min-h-[22rem] flex-col justify-between rounded-xl bg-[#10261d] p-6 sm:p-8">
          <p className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-moss sm:text-sm">Por encargo</p>
          <div>
            <p className="font-display text-[clamp(2.75rem,5vw,4.25rem)] uppercase leading-[0.95] tracking-[0.01em] text-bone [-webkit-text-stroke:0.03em_currentColor]">
              Decinos qué buscás y te lo traemos.
            </p>
            <a
              href={whatsappUrl(messages.order)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-moss px-5 font-ui text-[0.95rem] font-bold text-ink-0 transition-colors hover:bg-[#5fe0ad]"
            >
              <WhatsAppIcon size={18} /> Pedir algo que no está en la lista
            </a>
          </div>
        </div>
        <div className="min-w-0">
          {status === 'loading' && items.length === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="stripes aspect-[4/5] animate-pulse rounded-xl bg-[#10221b]" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="flex h-full items-center rounded-xl border border-dashed border-moss/30 p-6 text-mute">
              Ahora mismo tenemos todo en stock. Si buscás algo puntual, escribinos y lo traemos.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {shown.map((product) => (
                <ShowcaseEncargoCard key={product.code} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="nosotros" aria-labelledby="nosotros-title" className="relative isolate overflow-hidden bg-ink-0">
      <img
        src={asset('/img/hero-1024.webp')}
        srcSet={asset('/img/hero-640.webp 640w, /img/hero-1024.webp 1024w, /img/hero-1600.webp 1600w')}
        sizes="100vw"
        alt=""
        width={1600}
        height={900}
        loading="lazy"
        decoding="async"
        className="aspect-[16/10] w-full object-cover object-[40%_30%] lg:absolute lg:inset-0 lg:-z-10 lg:aspect-auto lg:h-full lg:object-[30%_30%]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 aspect-[16/10] bg-gradient-to-b from-transparent from-50% to-ink-0 lg:inset-0 lg:-z-10 lg:aspect-auto lg:bg-gradient-to-l lg:from-ink-0/95 lg:from-15% lg:via-ink-0/70 lg:via-45% lg:to-transparent lg:to-75%" />
      <div className={`${container} relative -mt-10 pb-16 lg:mt-0 lg:flex lg:min-h-[38rem] lg:items-center lg:justify-end lg:py-24`}>
        <div className="max-w-[36rem]">
          <p className="font-ui text-xs font-bold uppercase tracking-[0.22em] text-ember sm:text-sm">Nosotros</p>
          <h2 id="nosotros-title" className={`${poster} mt-3 text-[clamp(2.75rem,4.4vw,3.9rem)]`}>
            Somos jugadores antes que vendedores.
          </h2>
          <div className="mt-6 space-y-4 font-ui text-lg leading-snug text-bone/75">
            <p>
              En Ludus vas a encontrar el stock que necesitás, asesoramiento real de gente que pinta y juega, y mesas en el local
              para que armes tu próxima partida. Lo que ves disponible en la web está en el local.
            </p>
            <p>
              Si no sabés por dónde empezar, vení a ver una partida o escribinos: te ayudamos a elegir la caja de inicio, las
              pinturas y las herramientas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Tonos de las tarjetas de categoría sin foto, en orden: marrón, verde, azul y oliva.
const CATEGORY_TONES = ['bg-[#2a1912]', 'bg-[#122a20]', 'bg-[#161b2e]', 'bg-[#27231b]'];

const categoryPhotos = new Map(Object.entries(store.categoryImages).map(([name, file]) => [normalize(name), file]));

function Categories() {
  const { products } = useProducts();
  const categories = categoriesOf(products);
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="categorias-title" className="pb-16 pt-16 sm:pb-24 sm:pt-24">
      <SectionHeading id="categorias-title" title="Comprá por categoría" />
      <Carousel label="Categorías">
        {categories.map((name, index) => {
          const photo = categoryPhotos.get(normalize(name));
          return (
            <Link
              key={name}
              to={`/productos?categoria=${encodeURIComponent(name)}`}
              className={`group relative isolate flex aspect-[4/5] w-[62vw] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-line-soft p-5 transition-colors hover:border-ember/50 sm:w-[34vw] lg:w-[min(26vw,22.5rem)] ${photo ? 'bg-ink-3' : `stripes ${CATEGORY_TONES[index % CATEGORY_TONES.length]}`}`}
            >
              {photo && (
                <>
                  <img
                    src={asset(`/img/categorias/${photo}-400.webp`)}
                    srcSet={asset(`/img/categorias/${photo}-400.webp 400w, /img/categorias/${photo}-800.webp 800w`)}
                    sizes="(min-width: 1024px) 22.5rem, (min-width: 640px) 34vw, 62vw"
                    alt=""
                    width={400}
                    height={500}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 -z-10 size-full object-cover"
                  />
                  {/* Oscurece arriba y abajo para que se lean el nombre y "Ver productos" sobre cualquier foto. */}
                  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,7,16,0.75)_0%,rgba(6,7,16,0.1)_30%,rgba(6,7,16,0.1)_60%,rgba(6,7,16,0.85)_100%)]" />
                </>
              )}
              <span className="font-ui text-lg font-bold text-white sm:text-xl">{name}</span>
              <span className={`font-ui text-sm font-semibold transition-colors group-hover:text-ember ${photo ? 'text-bone/85' : 'text-bone/55'}`}>
                Ver productos <span aria-hidden="true">→</span>
              </span>
            </Link>
          );
        })}
      </Carousel>
      <p className={`${container} mt-4 font-ui text-xs text-dim`}>
        Fotos de categorías:{' '}
        {store.categoryPhotoCredits.map((credit, index) => (
          <span key={credit.author}>
            {index > 0 && (index === store.categoryPhotoCredits.length - 1 ? ' y ' : ', ')}
            <a href={credit.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-bone hover:underline">
              {credit.author}
            </a>
          </span>
        ))}{' '}
        (CC BY).
      </p>
    </section>
  );
}

function Contact() {
  const channels = [
    {
      icon: <WhatsAppIcon className="text-moss" />,
      title: 'WhatsApp',
      text: 'Respondemos tus consultas',
      action: 'Escribinos',
      href: whatsappUrl(messages.general),
    },
    { icon: <InstagramIcon className="text-[#e1306c]" />, title: 'Instagram', text: store.instagram.handle, action: 'Seguinos', href: store.instagram.url },
    { icon: <PinIcon className="text-ember" />, title: 'Local', text: store.address, action: 'Cómo llegar', href: store.mapsUrl },
  ];

  return (
    <section id="contacto" aria-labelledby="contacto-title" className="border-t border-line-soft bg-ink-0 py-16 sm:py-24">
      <SectionHeading id="contacto-title" title="Contacto." subtitle="Escribinos o vení al local." />
      <div className={`${container} grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8`}>
        <ul className="grid gap-3">
          {channels.map((channel) => (
            <li key={channel.title}>
              <a
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-xl border border-line-soft bg-ink-2 p-4 transition-colors hover:border-line sm:p-5"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink-3">{channel.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-ui text-lg font-bold text-white">{channel.title}</span>
                  <span className="block truncate font-ui text-bone/60">{channel.text}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 font-ui font-bold text-ember transition-colors group-hover:text-ember-hi sm:inline-flex">
                  {channel.action} <span aria-hidden="true">→</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <iframe
          title={`Mapa: ${store.address}`}
          src={store.mapEmbedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-80 w-full rounded-xl border border-line-soft lg:h-full lg:min-h-80"
        />
      </div>
      <div className={`${container} mt-10`}>
        <h3 className="flex items-center gap-2.5 font-ui text-lg font-bold tracking-normal text-white [-webkit-text-stroke:0]">
          <ClockIcon className="text-ember" /> Horarios
        </h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {store.hours.map((slot) => (
            <div key={slot.days} className="rounded-xl border border-line-soft bg-ink-2 px-5 py-4 text-center">
              <dt className="font-ui font-bold text-white">{slot.days}</dt>
              <dd className="font-ui font-semibold text-ember">{slot.time}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Home() {
  useTitle();

  return (
    <>
      <Hero />
      <Featured />
      <PlayAtTheStore />
      <Encargos />
      <About />
      <Categories />
      <Contact />
    </>
  );
}
