import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from '../lib/useOverlay';
import { CloseIcon, ExpandIcon } from './Icons';
import { ProductImage } from './ProductImage';

// Foto de producto que se abre en pantalla completa al hacer clic. Sin foto (o si no carga), queda el placeholder de
// siempre, sin botón.
export function ZoomableImage({ src, alt, className = '' }: { src: string | null; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  if (!src || broken) return <ProductImage src={null} alt={alt} className={className} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver la foto de ${alt} en pantalla completa`}
        className={`group relative block cursor-zoom-in overflow-hidden bg-ink-3 ${className}`}
      >
        <img
          src={src}
          alt={alt}
          decoding="async"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-ink/80 text-bone opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-lg:opacity-100"
        >
          <ExpandIcon size={18} />
        </span>
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const panel = useOverlay<HTMLDivElement>(true, onClose);

  // Va al body para que ningún contenedor con sticky o transform lo recorte. Un clic en cualquier lado lo cierra.
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-ink-0/95 p-4 outline-none motion-safe:animate-[fade_150ms_ease-out] sm:p-10"
    >
      {/* Tamaño natural de la foto, sin agrandarla; si es más grande que la pantalla, se achica hasta entrar. */}
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
      <button
        type="button"
        onClick={onClose}
        data-autofocus
        aria-label="Cerrar"
        className="absolute right-3 top-3 flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-5 sm:top-5"
      >
        <CloseIcon />
      </button>
    </div>,
    document.body,
  );
}
