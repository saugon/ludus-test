// Botones con la tipografía de interfaz de la tienda anterior: Rajdhani en mayúsculas espaciadas.
const base =
  'inline-flex items-center justify-center gap-2 text-center font-ui font-bold uppercase leading-tight tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const button = {
  primary: `${base} min-h-12 py-2 rounded-2xl px-5 bg-ember text-ember-ink shadow-[0_4px_20px_rgba(245,106,45,0.4),0_0_40px_rgba(245,106,45,0.15)] hover:bg-ember-hi active:bg-ember-lo`,
  order: `${base} min-h-12 py-2 rounded-2xl px-5 bg-moss text-ink hover:bg-[#5fe0ad] active:bg-moss-lo active:text-bone`,
  // Para los botones de los pasos de la compra, que van en una columna angosta.
  primaryCompact: `${base} min-h-12 py-2 rounded-xl px-4 text-base bg-ember text-ember-ink shadow-[0_4px_16px_rgba(245,106,45,0.3)] hover:bg-ember-hi active:bg-ember-lo`,
  secondary: `${base} min-h-12 py-2 rounded-2xl px-5 border border-line text-bone hover:border-mute hover:bg-ink-3`,
  ghost: `${base} h-11 rounded-md px-3 text-mute hover:text-bone`,
  small: `${base} h-11 rounded-md px-4 text-[0.95rem]`,
  // La pastilla "Agregar" de las tarjetas de producto, sin mayúsculas.
  cardAdd:
    'inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-ember px-4 font-ui text-[0.9rem] font-bold text-ember-ink transition-colors hover:bg-ember-hi active:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50',
};

// Títulos de sección en Rajdhani, sin el trazo de los de Bebas Neue (los de la home y el del catálogo).
export const sectionTitle =
  'font-ui text-[clamp(1.75rem,3.4vw,2.6rem)] font-semibold leading-[1.15] tracking-normal [-webkit-text-stroke:0] text-white';

export const container = 'mx-auto w-full max-w-site px-4 sm:px-6 lg:px-8';

export const field =
  'h-12 w-full rounded-md border border-line bg-ink-2 px-4 text-bone placeholder:text-mute/80 focus:border-ember focus:outline-none aria-[invalid=true]:border-alert';
