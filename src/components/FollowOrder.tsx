import { StorefrontError } from '@vertex/storefront-sdk';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ACCOUNT_PATH, signInPath } from '../shopper/returnPath';
import { useShopper } from '../shopper/ShopperProvider';
import { ErrorNotice } from './ErrorNotice';
import { button, field } from './ui';

const CODE_LENGTH = 6;
const BUYER_KEY = 'ludus:order-buyer';

export type OrderBuyer = { name: string; email: string };

// Quién hizo la última compra en esta pestaña. El checkout borra sus datos al terminar; esto los guarda aparte para
// que /pedido pueda ofrecer entrar con ese email, también después de recargar.
export function rememberOrderBuyer(buyer: OrderBuyer): OrderBuyer | null {
  try {
    if (buyer.email.trim()) {
      sessionStorage.setItem(BUYER_KEY, JSON.stringify({ name: buyer.name.trim(), email: buyer.email.trim() }));
      return { name: buyer.name.trim(), email: buyer.email.trim() };
    }
    const saved = JSON.parse(sessionStorage.getItem(BUYER_KEY) ?? 'null') as Partial<OrderBuyer> | null;
    return saved && typeof saved.email === 'string' && saved.email ? { name: typeof saved.name === 'string' ? saved.name : '', email: saved.email } : null;
  } catch {
    return buyer.email.trim() ? buyer : null;
  }
}

function codeOf(error: unknown) {
  return error instanceof StorefrontError ? error.code : null;
}

type Step = { name: 'offer' } | { name: 'code'; minutes: number };

// Después de comprar sin sesión: entrar con el email de la compra, con el código ahí mismo, para seguir el pedido
// desde Mis pedidos. La cuenta es la del email, así que el pedido ya está ahí; si el email no tenía cuenta, se crea
// con el nombre de la compra.
export function FollowOrder({ buyer, what }: { buyer: OrderBuyer | null; what: string }) {
  const session = useShopper();
  const navigate = useNavigate();
  const ids = { title: useId(), code: useId() };
  const [step, setStep] = useState<Step>({ name: 'offer' });
  const [code, setCode] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const sending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);

  const wait = buyer && step.name === 'code' ? session.resendWait(buyer.email) : 0;
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  // Sin el email de la compra (otra pestaña, otro dispositivo) queda el ingreso de siempre.
  if (!buyer || !buyer.name) {
    return (
      <p className="text-mute">
        ¿Querés seguir el estado del {what}?{' '}
        <Link to={signInPath(ACCOUNT_PATH)} className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi">
          Ingresá con el email de la compra
        </Link>
        .
      </p>
    );
  }
  const { name, email } = buyer;

  async function run(action: () => Promise<void>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await action();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function send(again: boolean) {
    setNotice(null);
    if (!again && session.resendWait(email) > 0) {
      setStep({ name: 'code', minutes: 10 });
      setNotice('Ya te mandamos un código hace un momento. Usá ese.');
      return;
    }
    void run(async () => {
      try {
        const sent = await session.requestCode(email);
        setStep({ name: 'code', minutes: Math.max(1, Math.round(sent.expiresIn / 60)) });
        setCode('');
        setInputError(null);
        setLocked(false);
        if (again) setNotice('Te mandamos un código nuevo. El anterior ya no sirve.');
        codeInput.current?.focus();
      } catch (error) {
        setFailure(error);
      }
    });
  }

  function submit(value: string) {
    if (locked) return;
    if (value.length !== CODE_LENGTH) {
      setInputError(`El código tiene ${CODE_LENGTH} números.`);
      return;
    }
    setNotice(null);
    void run(async () => {
      try {
        const answer = await session.signIn(email, value);
        if (answer.status === 'needs_name') await session.completeSignUp(name);
        navigate(ACCOUNT_PATH);
      } catch (error) {
        const reason = codeOf(error);
        if (reason === 'invalid_code') {
          setCode('');
          setInputError('El código está mal o ya venció. Revisalo o pedí uno nuevo.');
          codeInput.current?.focus();
        } else if (reason === 'too_many_attempts') {
          setLocked(true);
          setInputError(null);
          setFailure(error);
        } else {
          setFailure(error);
        }
      }
    });
  }

  return (
    <section aria-labelledby={ids.title} className="rounded-lg border border-line bg-ink-2 p-5 text-left sm:p-6">
      <h2 id={ids.title} className="font-sans text-lg font-semibold leading-tight tracking-normal [-webkit-text-stroke:0]">
        Seguí tu pedido desde Mis pedidos
      </h2>

      {step.name === 'offer' ? (
        <>
          <p className="mt-2 text-mute">
            Te mandamos un código a <strong className="font-semibold text-bone [overflow-wrap:anywhere]">{email}</strong> y entrás a tu cuenta, con este pedido
            adentro. Sin contraseña.
          </p>
          {failure != null && (
            <div className="mt-4">
              <ErrorNotice error={failure} />
            </div>
          )}
          <button type="button" onClick={() => send(false)} disabled={busy} className={`${button.secondary} mt-4 w-full sm:w-auto`}>
            {busy ? 'Enviando…' : 'Mandarme el código'}
          </button>
        </>
      ) : (
        <form
          noValidate
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            submit(code);
          }}
          className="mt-2 space-y-4"
        >
          <p className="text-mute">
            Escribí el código de {CODE_LENGTH} números que mandamos a <strong className="font-semibold text-bone [overflow-wrap:anywhere]">{email}</strong>. Vence en{' '}
            {step.minutes} minutos.
          </p>
          {notice && (
            <p role="status" className="text-sm text-bone">
              {notice}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor={ids.code} className="sr-only">
              Código
            </label>
            <input
              ref={codeInput}
              id={ids.code}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={CODE_LENGTH}
              disabled={locked}
              value={code}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
                setCode(digits);
                setInputError(null);
                if (digits.length === CODE_LENGTH) submit(digits);
              }}
              aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? `${ids.code}-error` : undefined}
              className={`${field} h-14 text-center font-display text-4xl tracking-[0.5em]`}
            />
            {inputError && (
              <p id={`${ids.code}-error`} className="text-sm text-alert">
                {inputError}
              </p>
            )}
          </div>
          {failure != null && <ErrorNotice error={failure} />}
          {!locked && (
            <button type="submit" disabled={busy} className={`${button.secondary} w-full sm:w-auto`}>
              {busy ? 'Revisando…' : 'Entrar a Mis pedidos'}
            </button>
          )}
          <p className="text-sm text-mute">
            ¿No llega? Fijate en spam o{' '}
            <button
              type="button"
              onClick={() => send(true)}
              disabled={busy || wait > 0}
              className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi disabled:no-underline disabled:opacity-60"
            >
              {wait > 0 ? `pedí otro en ${wait} s` : 'pedí otro código'}
            </button>
            .
          </p>
        </form>
      )}
    </section>
  );
}
