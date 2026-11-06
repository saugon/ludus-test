import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useCart } from '../cart/CartProvider';
import { store, whatsappUrl, messages } from '../content';
import { useOverlay } from '../lib/useOverlay';
import { firstName, useShopper } from '../shopper/ShopperProvider';
import { ACCOUNT_PATH } from '../shopper/returnPath';
import { BagIcon, CloseIcon, InstagramIcon, MenuIcon, SearchIcon, UserIcon, WhatsAppIcon } from './Icons';
import { SearchForm } from './SearchForm';
import { container } from './ui';
import { asset } from '../lib/paths';

export const NAV = [
  { to: '/productos', label: 'Productos' },
  { to: '/#encargos', label: 'Encargos' },
  { to: '/#jugar', label: 'Vení a jugar' },
  { to: '/#nosotros', label: 'Nosotros' },
  { to: '/#contacto', label: 'Contacto' },
];

// El logo de la tienda anterior: ícono del coliseo + "LUDUS GAME STORE" con "GAME" en naranja y el subtítulo.
export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 sm:gap-3 ${className}`}>
      <img src={asset('/logo.svg')} alt="" width={42} height={42} className="size-8 shrink-0 rounded-lg sm:size-[42px]" />
      <span className="flex min-w-0 flex-col">
        <span className="whitespace-nowrap font-display text-[1.2rem] leading-none tracking-[0.06em] text-white max-[379px]:text-[1.05rem] sm:text-[1.7rem]">
          Ludus <em className="not-italic text-ember">Game</em> Store
        </span>
        <span className="mt-px whitespace-nowrap font-ui text-[0.6rem] font-bold uppercase leading-none tracking-[0.2em] text-dim max-[379px]:tracking-[0.12em] sm:text-[0.7rem] sm:tracking-[0.28em]">
          Wargames · Argentina
        </span>
      </span>
    </span>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex min-w-0 shrink items-center lg:shrink-0" aria-label={`${store.name}, inicio`}>
      <Brand />
    </Link>
  );
}

const iconButton = 'flex size-10 shrink-0 items-center justify-center rounded-full text-bone/85 transition-colors hover:bg-white/10 hover:text-white sm:size-11';

function CartButton() {
  const cart = useCart();
  const count = cart.count;

  return (
    <button
      type="button"
      onClick={cart.openDrawer}
      className="relative flex h-10 shrink-0 items-center gap-2 rounded-full px-2.5 font-ui text-[0.88rem] font-bold uppercase tracking-[0.1em] text-bone/85 transition-colors hover:bg-white/10 hover:text-white sm:h-11 xl:px-3"
      aria-label={count > 0 ? `Abrir carrito, ${count} ${count === 1 ? 'producto' : 'productos'}` : 'Abrir carrito, vacío'}
    >
      <BagIcon />
      <span className="hidden xl:inline">Carrito</span>
      {count > 0 && (
        <span
          key={count}
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1.5 font-ui text-xs font-bold tracking-normal text-ember-ink motion-safe:animate-[pop_300ms_ease-out] max-xl:absolute max-xl:-right-0.5 max-xl:top-0"
        >
          {count}
        </span>
      )}
    </button>
  );
}

function AccountLink() {
  const { status, shopper } = useShopper();
  const name = firstName(shopper);
  // 'loading' quiere decir que hay sesión guardada y la API todavía no respondió: se muestra la cuenta,
  // con el perfil recordado, en vez de «Ingresar» por un instante.
  const signedIn = status === 'member' || status === 'error' || status === 'loading';
  const label = signedIn ? (name ? `Mis pedidos, sesión de ${name}` : 'Mis pedidos') : 'Ingresar';

  if (signedIn) {
    return (
      <Link to={ACCOUNT_PATH} aria-label={label} title="Mis pedidos" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-ink-3 sm:size-11">
        <span className="flex size-8 items-center justify-center rounded-full bg-ember font-display text-xl leading-none text-ember-ink sm:size-9" aria-hidden="true">
          {name ? name.charAt(0).toUpperCase() : <UserIcon size={18} />}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to={ACCOUNT_PATH}
      aria-label={label}
      title="Ingresar"
      className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-ember px-3 font-ui text-[0.72rem] font-bold uppercase tracking-[0.05em] text-ember-ink transition-colors hover:bg-ember-hi active:bg-ember-lo sm:text-[0.78rem] lg:px-4 xl:px-[1.6rem]"
    >
      <UserIcon size={14} strokeWidth={2.6} className="hidden shrink-0 sm:block" />
      Ingresar
    </Link>
  );
}

function MobileAccountLink({ onClose }: { onClose: () => void }) {
  const { status, shopper } = useShopper();
  const signedIn = status === 'member' || status === 'error' || status === 'loading';

  return (
    <Link to={ACCOUNT_PATH} onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 font-ui font-bold uppercase tracking-[0.08em] text-bone hover:border-mute">
      <UserIcon className="shrink-0 text-ember" />
      <span className="min-w-0">
        {signedIn ? 'Mis pedidos' : 'Ingresar'}
        {signedIn && shopper && <span className="block truncate font-sans text-sm font-normal normal-case tracking-normal text-mute">{shopper.email}</span>}
      </span>
    </Link>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useOverlay<HTMLDivElement>(open, onClose);
  const cart = useCart();
  const count = cart.count;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/65" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Menú" tabIndex={-1} className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto bg-ink-2 outline-none">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Brand />
          <button type="button" onClick={onClose} data-autofocus className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink-3" aria-label="Cerrar menú">
            <CloseIcon />
          </button>
        </div>
        <div className="px-4 pb-4">
          <SearchForm onSearch={onClose} />
        </div>
        <nav aria-label="Principal" className="px-4">
          <ul className="divide-y divide-line-soft border-y border-line-soft">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} onClick={onClose} className="block py-4 font-ui text-base font-bold uppercase tracking-[0.12em] text-mute hover:text-ember">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  cart.openDrawer();
                }}
                className="flex w-full items-center gap-2 py-4 text-left font-ui text-base font-bold uppercase tracking-[0.12em] text-mute hover:text-ember"
              >
                Carrito
                {count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1.5 text-xs tracking-normal text-ember-ink">{count}</span>
                )}
              </button>
            </li>
          </ul>
        </nav>
        <div className="px-4 pt-5">
          <MobileAccountLink onClose={onClose} />
        </div>
        <div className="mt-auto space-y-3 p-4 text-mute">
          <a href={whatsappUrl(messages.general)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-moss font-ui font-bold uppercase tracking-[0.08em] text-ink">
            <WhatsAppIcon /> Escribinos por WhatsApp
          </a>
          <a href={store.instagram.url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-2 hover:text-bone">
            <InstagramIcon /> {store.instagram.handle}
          </a>
          <p className="text-sm">{store.address}</p>
        </div>
      </div>
    </div>
  );
}

// En la home el navbar arranca transparente sobre el hero y toma fondo apenas se scrollea.
function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);

  return scrolled;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const scrolled = useScrolled();
  const overHero = location.pathname === '/' && !scrolled && !searchOpen;

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search, location.hash]);

  return (
    <>
    <header
      data-over-hero={overHero || undefined}
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300 ${
        overHero ? 'border-transparent bg-transparent' : 'border-line-soft bg-ink-0/90 backdrop-blur-md supports-[backdrop-filter]:bg-ink-0/75'
      }`}
    >
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-ember focus:px-3 focus:py-2 focus:text-ember-ink">
        Saltar al contenido
      </a>
      <div className={`${container} flex h-16 items-center gap-1 sm:gap-2 lg:h-[4.5rem] lg:gap-4 xl:gap-6`}>
        <button type="button" onClick={() => setMenuOpen(true)} className={`${iconButton} -ml-2 lg:hidden`} aria-label="Abrir menú">
          <MenuIcon />
        </button>
        <Logo />
        <nav aria-label="Principal" className="hidden lg:mx-auto lg:block">
          <ul className="flex items-center xl:gap-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex h-10 items-center whitespace-nowrap px-2 font-ui text-[0.88rem] font-bold uppercase tracking-[0.1em] transition-colors hover:text-white xl:px-3 ${isActive && item.to === '/productos' ? 'text-ember' : 'text-bone/85'}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2 lg:ml-0 xl:gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className={`${iconButton} max-sm:hidden`}
            aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar productos'}
            aria-expanded={searchOpen}
          >
            {searchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>
          <CartButton />
          <AccountLink />
        </div>
      </div>
      {searchOpen && (
        <div className={`${container} pb-3 max-sm:hidden`}>
          <SearchForm autoFocus onSearch={() => setSearchOpen(false)} />
        </div>
      )}
    </header>
    <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
