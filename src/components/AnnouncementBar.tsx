import { useEffect, useState, type ReactNode } from 'react';

// La barra naranja de la tienda anterior. En desktop muestra los tres mensajes; en mobile, uno por vez.
const ROTATE_MS = 4000;

const svg = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, focusable: false } as const;

export const ANNOUNCEMENTS: { text: string; icon: ReactNode }[] = [
  {
    text: 'Stock actualizado semanalmente',
    icon: (
      <svg {...svg}>
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5.2 7.7-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4l2.3 2.29 5.3-5.3a1 1 0 1 1 1.4 1.42Z" />
      </svg>
    ),
  },
  {
    text: 'Envíos a todo el país',
    icon: (
      <svg {...svg} width={19}>
        <path d="M2 5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v2h3.6a1 1 0 0 1 .8.4l2.4 3.2a1 1 0 0 1 .2.6V16a1 1 0 0 1-1 1h-1.05a2.5 2.5 0 0 1-4.9 0H9.95a2.5 2.5 0 0 1-4.9 0H3a1 1 0 0 1-1-1V5Zm13 4v3h4.75L17.5 9H15ZM7.5 18.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
    ),
  },
  {
    text: 'Respondemos a tus consultas',
    icon: (
      <svg {...svg} width={18}>
        <path d="M3 3h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm15 5h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-5a2 2 0 0 1-2-2v-1h5a4 4 0 0 0 4-4V8Z" />
      </svg>
    ),
  },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AnnouncementBar() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // Sin rotación si el usuario pidió reducir el movimiento, y en pausa mientras la barra tiene el mouse o el foco.
    if (paused || prefersReducedMotion()) return;
    const timer = setInterval(() => setActive((index) => (index + 1) % ANNOUNCEMENTS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="bg-ember text-ember-ink"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul aria-label="Novedades" className="flex items-center justify-center gap-[0.8rem] px-[0.8rem] py-[0.3rem] font-ui text-xs font-bold uppercase leading-[1.5] tracking-[0.04em] md:gap-8 md:px-4 md:py-[0.35rem] md:text-[0.82rem]">
        {ANNOUNCEMENTS.map((item, index) => (
          // En mobile se ve un mensaje por vez; los otros quedan solo para lectores de pantalla.
          <li key={item.text} className={`flex items-center gap-[0.45rem] whitespace-nowrap ${index === active ? '' : 'max-md:sr-only'}`}>
            {index > 0 && <span aria-hidden="true" className="mr-[1.6rem] hidden h-3 w-px bg-black/18 md:block" />}
            {item.icon}
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
