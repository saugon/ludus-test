import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { messages, whatsappUrl } from '../content';
import { CartDrawer } from './CartDrawer';
import { Footer } from './Footer';
import { Header } from './Header';
import { WhatsAppIcon } from './Icons';

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

export function Layout() {
  const { drawerOpen } = useCart();
  const { pathname } = useLocation();
  const fab = !drawerOpen && !/^\/(productos\/.+|checkout(\/.*)?|pedido|ingresar)$/.test(pathname);
  // En todas las páginas el contenido ocupa al menos la pantalla, así el footer no asoma debajo y sólo aparece al scrollear.
  // Se resta un poco menos de lo que mide el header (64 y 72 px).
  const fullHeight = 'min-h-[calc(100dvh-3.9rem)] lg:min-h-[calc(100dvh-4.4rem)]';

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <Header />
      <main id="contenido" className={`flex-1 ${fullHeight}`}>
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      {fab && (
        <a
          href={whatsappUrl(messages.general)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escribinos por WhatsApp"
          className="fixed bottom-4 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-moss text-ink shadow-lg shadow-black/40 hover:bg-[#62dfa9]"
        >
          <WhatsAppIcon size={28} />
        </a>
      )}
    </div>
  );
}
