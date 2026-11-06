import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { messages, whatsappUrl } from '../content';
import { AnnouncementBar } from './AnnouncementBar';
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
  // En los pasos de la compra y en la cuenta el contenido ocupa al menos la pantalla, así el footer no asoma debajo.
  // Se resta un poco menos de lo que miden la barra de anuncios y el header (92, 96 y 104 px).
  const fullHeight = /^\/(checkout|cuenta)(\/|$)/.test(pathname) ? 'min-h-[calc(100dvh-5.75rem)] md:min-h-[calc(100dvh-5.95rem)] lg:min-h-[calc(100dvh-6.45rem)]' : '';

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      {/* La barra de anuncios se va con el scroll; el navbar queda fijo arriba. */}
      <AnnouncementBar />
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
