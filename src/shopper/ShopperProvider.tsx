import { StorefrontError, type Shopper, type ShopperSignIn } from '@vertex/storefront-sdk';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStorefront } from '../lib/storefront';

export type ShopperStatus = 'loading' | 'guest' | 'member' | 'error';

export type ShopperValue = {
  status: ShopperStatus;
  shopper: Shopper | null;
  error: unknown;
  expired: boolean;
  requestCode: (email: string) => Promise<{ expiresIn: number }>;
  resendWait: (email: string) => number;
  signIn: (email: string, code: string) => Promise<ShopperSignIn>;
  completeSignUp: (name: string) => Promise<Shopper>;
  signOut: () => void;
  expire: () => void;
  refresh: () => Promise<void>;
};

export const CODE_RESEND_SECONDS = 60;

const ShopperContext = createContext<ShopperValue | null>(null);

export function shopperStorageKey(venue: string): string {
  return `vertex-storefront:${venue}:shopper`;
}

export function isSessionError(error: unknown): boolean {
  return error instanceof StorefrontError && error.code === 'shopper_unauthorized';
}

// El nombre y el email de la última sesión, para que el header muestre la cuenta apenas carga la página
// en vez de «Ingresar» hasta que responde la API. Si la sesión venció, la respuesta lo corrige.
export function profileStorageKey(venue: string): string {
  return `ludus:${venue}:shopper-profile`;
}

function readProfile(venue: string): Shopper | null {
  try {
    const saved = JSON.parse(localStorage.getItem(profileStorageKey(venue)) ?? 'null') as Partial<Shopper> | null;
    return saved && typeof saved.name === 'string' && typeof saved.email === 'string' ? { name: saved.name, email: saved.email } : null;
  } catch {
    return null;
  }
}

function writeProfile(venue: string, shopper: Shopper | null) {
  try {
    if (shopper) localStorage.setItem(profileStorageKey(venue), JSON.stringify({ name: shopper.name, email: shopper.email }));
    else localStorage.removeItem(profileStorageKey(venue));
  } catch {
    // Sin localStorage el header espera a la API, como antes.
  }
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

export function ShopperProvider({ venue, children }: { venue: string; children: ReactNode }) {
  const { shopper: account } = useStorefront();
  const [status, setStatus] = useState<ShopperStatus>(() => (account.isSignedIn() ? 'loading' : 'guest'));
  // Mientras carga, shopper es el perfil recordado (status sigue en 'loading': no cuenta como sesión).
  const [shopper, setShopper] = useState<Shopper | null>(() => (account.isSignedIn() ? readProfile(venue) : null));
  const [error, setError] = useState<unknown>(null);
  const [expired, setExpired] = useState(false);
  const generation = useRef(0);
  const codesSentAt = useRef(new Map<string, number>());

  const settle = useCallback(
    (next: Shopper | null, failure: unknown = null) => {
      generation.current += 1;
      setShopper(next);
      setError(failure);
      setStatus(next ? 'member' : failure ? 'error' : 'guest');
      // Con un error que no es de sesión (la API no respondió) el token sigue: el perfil también.
      if (next || !failure) writeProfile(venue, next);
    },
    [venue],
  );

  const refresh = useCallback(async () => {
    if (!account.isSignedIn()) {
      settle(null);
      return;
    }
    const current = ++generation.current;
    setStatus((previous) => (previous === 'member' ? previous : 'loading'));
    try {
      const loaded = await account.get();
      if (current !== generation.current) return;
      settle(loaded);
    } catch (failure) {
      if (current !== generation.current) return;
      if (isSessionError(failure)) {
        setExpired(true);
        settle(null);
      } else {
        settle(null, failure);
      }
    }
  }, [account, settle]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const key = shopperStorageKey(venue);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) void refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [venue, refresh]);

  const requestCode = useCallback(
    async (email: string) => {
      const sent = await account.requestCode(email.trim());
      codesSentAt.current.set(emailKey(email), Date.now());
      return sent;
    },
    [account],
  );

  const resendWait = useCallback((email: string) => {
    const sentAt = codesSentAt.current.get(emailKey(email));
    if (sentAt === undefined) return 0;
    return Math.max(0, CODE_RESEND_SECONDS - Math.floor((Date.now() - sentAt) / 1000));
  }, []);

  const signIn = useCallback(
    async (email: string, code: string) => {
      const answer = await account.signIn({ email: email.trim(), code: code.trim() });
      if (answer.status === 'signed_in') {
        setExpired(false);
        settle(answer.shopper);
      }
      return answer;
    },
    [account, settle],
  );

  const completeSignUp = useCallback(
    async (name: string) => {
      const created = await account.completeSignUp(name.trim());
      setExpired(false);
      settle(created);
      return created;
    },
    [account, settle],
  );

  const signOut = useCallback(() => {
    account.signOut();
    setExpired(false);
    settle(null);
  }, [account, settle]);

  const expire = useCallback(() => {
    account.signOut();
    setExpired(true);
    settle(null);
  }, [account, settle]);

  const value = useMemo<ShopperValue>(
    () => ({ status, shopper, error, expired, requestCode, resendWait, signIn, completeSignUp, signOut, expire, refresh }),
    [status, shopper, error, expired, requestCode, resendWait, signIn, completeSignUp, signOut, expire, refresh],
  );

  return <ShopperContext.Provider value={value}>{children}</ShopperContext.Provider>;
}

export function useShopper(): ShopperValue {
  const value = useContext(ShopperContext);
  if (!value) throw new Error('useShopper needs a ShopperProvider');
  return value;
}

export function firstName(shopper: Shopper | null): string {
  return shopper?.name.trim().split(/\s+/)[0] ?? '';
}
