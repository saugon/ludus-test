import type { Product } from '@vertex/storefront-sdk';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { messages, whatsappUrl } from '../content';
import { money } from '../lib/format';
import { AddToCart } from './AddToCart';

// Tarjetas de producto (home y catálogo): la foto ocupa toda la tarjeta, con la categoría arriba y el nombre, el precio
// y la acción sobre un degradado abajo. Sin foto, queda el rayado del color de la tarjeta. Son `@container`: en
// columnas angostas (el catálogo en mobile) el botón baja debajo del precio.

function Photo({ src, tone }: { src: string | null; tone: 'ink' | 'moss' }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <div aria-hidden="true" className={`stripes absolute inset-0 -z-10 ${tone === 'moss' ? 'bg-[#10221b]' : 'bg-ink-3'}`} />;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.04]"
    />
  );
}

const shell = '@container group relative isolate flex flex-col justify-between overflow-hidden rounded-xl border border-line-soft p-3 sm:p-4';
const eyebrow = 'min-w-0 truncate font-ui text-[0.7rem] font-bold uppercase tracking-[0.18em] text-bone/80 sm:text-xs';
// Nombres largos: hasta tres líneas, así no empujan el precio fuera de la tarjeta.
const name = 'line-clamp-3 font-ui text-[0.95rem] font-bold leading-tight text-white [overflow-wrap:anywhere] [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] @min-[15rem]:text-lg';
const narrow = '@max-[12rem]:flex-col @max-[12rem]:items-stretch @max-[12rem]:gap-2';
// Oscurecen arriba (categoría) y abajo (nombre, precio y acción) para que se lean sobre fotos claras.
function Shade() {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-1/4 bg-gradient-to-b from-ink-0/70 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-3/5 bg-gradient-to-t from-ink-0 from-10% via-ink-0/70 via-45% to-transparent" />
    </>
  );
}
// El nombre es el link a la ficha; su área se estira a toda la tarjeta (foto incluida), debajo del botón. Para que el
// ::after tome la tarjeta entera, ningún contenedor intermedio puede ser `relative`: la foto y el degradado van en -z-10.
const stretched = 'after:absolute after:inset-0 after:z-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-ember-hi';

export function ShowcaseProductCard({ product, className = '' }: { product: Product; className?: string }) {
  const title = product.name ?? product.code;

  return (
    <article className={`${shell} aspect-[4/5] bg-ink-3 hover:border-ember/30 ${className}`}>
      <Photo src={product.image_url} tone="ink" />
      <Shade />
      <p className={eyebrow}>{product.category ?? ' '}</p>
      <div className={`flex items-end justify-between gap-3 ${narrow}`}>
        <div className="min-w-0">
          <h3 className={name}>
            <Link to={`/productos/${encodeURIComponent(product.code)}`} className={stretched}>
              {title}
            </Link>
          </h3>
          <p className="mt-0.5 whitespace-nowrap font-ui text-base font-semibold tabular-nums text-bone/85 @min-[15rem]:text-lg">{money(product.price, product.currency)}</p>
        </div>
        <AddToCart product={product} look="card" className="relative z-10 shrink-0" />
      </div>
    </article>
  );
}

/** `tagged`: muestra "Por encargo" arriba a la derecha, para cuando la tarjeta va mezclada con productos en stock. */
export function ShowcaseEncargoCard({ product, className = '', tagged = false }: { product: Product; className?: string; tagged?: boolean }) {
  const title = product.name ?? product.code;

  return (
    <article className={`${shell} aspect-[4/5] bg-[#10221b] hover:border-moss/30 ${className}`}>
      <Photo src={product.image_url} tone="moss" />
      <Shade />
      <div className="flex items-start justify-between gap-2">
        <p className={eyebrow}>{product.category ?? ' '}</p>
        {tagged && (
          <span className="shrink-0 rounded-full bg-ink-0/80 px-2 py-0.5 font-ui text-[0.65rem] font-bold uppercase tracking-[0.08em] text-moss sm:text-[0.7rem]">
            Por encargo
          </span>
        )}
      </div>
      <div>
        <h3 className={name}>
          <Link to={`/productos/${encodeURIComponent(product.code)}`} className={stretched}>
            {title}
          </Link>
        </h3>
        <div className={`mt-2 flex items-end justify-between gap-2 ${narrow}`}>
          {product.price ? (
            <p className="flex flex-col">
              <span className="font-ui text-[0.7rem] leading-tight text-bone/55">Precio de referencia</span>{' '}
              <span className="whitespace-nowrap font-ui text-[0.95rem] font-bold tabular-nums text-white">{money(product.price, product.currency)}</span>
            </p>
          ) : (
            <span />
          )}
          <a
            href={whatsappUrl(messages.product(title))}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Consultar por ${title} en WhatsApp`}
            className="relative z-10 -m-1 p-1 font-ui text-sm font-bold text-moss hover:text-[#5fe0ad]"
          >
            Consultar
          </a>
        </div>
      </div>
    </article>
  );
}
