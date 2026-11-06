// La tienda puede vivir en un subpath (en GitHub Pages, /ludus-web/). Vite lo deja en BASE_URL al
// compilar con --base; sin eso es '/' y todo queda como en la raíz.
const BASE = import.meta.env.BASE_URL;

// Para BrowserRouter: sin la barra final, y '/' en la raíz.
export const routerBase = BASE.replace(/\/$/, '') || '/';

// Un archivo de public/ ('/logo.svg') o un srcset con varios, con la base adelante.
export function asset(value: string): string {
  return value.replace(/(^|,\s*)\//g, `$1${BASE}`);
}

// La dirección completa de una página de la tienda ('/pedido'), para mandarla afuera.
export function pageUrl(path: string): string {
  return `${window.location.origin}${BASE}${path.replace(/^\//, '')}`;
}
