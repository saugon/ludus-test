import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

// Fila con scroll horizontal que se sale por el borde derecho de la pantalla. Con el dedo o el trackpad se desliza;
// en desktop suma flechas para quien usa solo el mouse. Tiene que ir fuera de `container`, a todo el ancho.
export function Carousel({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  function step(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  const arrow =
    'absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-ink/80 text-bone shadow-lg shadow-black/40 backdrop-blur transition-[opacity,background-color] hover:bg-ink-3 disabled:pointer-events-none disabled:opacity-0 lg:flex';

  return (
    <div className="relative">
      <div
        ref={track}
        role="region"
        aria-label={label}
        onScroll={measure}
        className={`bleed-row flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none ${className}`}
      >
        {children}
      </div>
      <button type="button" onClick={() => step(-1)} disabled={edges.start} aria-label="Anteriores" className={`${arrow} left-4`}>
        <ChevronLeftIcon />
      </button>
      <button type="button" onClick={() => step(1)} disabled={edges.end} aria-label="Siguientes" className={`${arrow} right-4`}>
        <ChevronRightIcon />
      </button>
    </div>
  );
}
