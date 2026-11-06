import { StorefrontError } from '@vertex/storefront-sdk';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ErrorNotice } from '../components/ErrorNotice';
import { MailIcon } from '../components/Icons';
import { button, container, field } from '../components/ui';
import { EMAIL_ERROR, isEmail } from '../lib/email';
import { useTitle } from '../lib/useTitle';
import { useShopper } from '../shopper/ShopperProvider';
import { safeReturnPath } from '../shopper/returnPath';

type Step = { name: 'email' } | { name: 'code'; email: string; minutes: number } | { name: 'name'; email: string };

const CODE_LENGTH = 6;

function codeOf(error: unknown) {
  return error instanceof StorefrontError ? error.code : null;
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm text-alert">
      {children}
    </p>
  );
}

export function SignIn() {
  useTitle('Ingresar');
  const session = useShopper();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('volver'));
  const ids = { email: useId(), code: useId(), name: useId() };

  const [step, setStep] = useState<Step>({ name: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const sending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);

  const wait = step.name === 'code' ? session.resendWait(step.email) : 0;

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  if (session.status === 'member') return <Navigate to={returnTo} replace />;

  if (session.status === 'loading') {
    return (
      <div className={`${container} py-20 text-center text-mute`} role="status">
        Revisando tu sesión…
      </div>
    );
  }

  function reset(next: Step) {
    setStep(next);
    setCode('');
    setInputError(null);
    setFailure(null);
    setLocked(false);
  }

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

  async function sendCode(target: string) {
    try {
      const sent = await session.requestCode(target);
      reset({ name: 'code', email: target.trim(), minutes: Math.max(1, Math.round(sent.expiresIn / 60)) });
      return true;
    } catch (error) {
      const reason = codeOf(error);
      if (reason === 'validation_error') setInputError(EMAIL_ERROR);
      else if (reason === 'service_unavailable') setInputError('No pudimos mandarte el código. Probá de nuevo en unos minutos.');
      else setFailure(error);
      return false;
    }
  }

  function submitEmail(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (!isEmail(email)) {
      setInputError(EMAIL_ERROR);
      return;
    }
    if (session.resendWait(email) > 0) {
      reset({ name: 'code', email: email.trim(), minutes: 10 });
      setNotice('Ya te mandamos un código a este email hace un momento. Usá ese.');
      return;
    }
    void run(async () => {
      await sendCode(email);
    });
  }

  function resend() {
    if (step.name !== 'code') return;
    setNotice(null);
    void run(async () => {
      if (await sendCode(step.email)) setNotice('Te mandamos un código nuevo. El anterior ya no sirve.');
      codeInput.current?.focus();
    });
  }

  function submitCode(value: string) {
    if (step.name !== 'code' || locked) return;
    if (value.length !== CODE_LENGTH) {
      setInputError(`El código tiene ${CODE_LENGTH} números.`);
      return;
    }
    setNotice(null);
    void run(async () => {
      try {
        const answer = await session.signIn(step.email, value);
        if (answer.status === 'needs_name') reset({ name: 'name', email: step.email });
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

  function submitName(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setInputError('Escribí tu nombre y apellido.');
      return;
    }
    void run(async () => {
      try {
        await session.completeSignUp(name);
      } catch (error) {
        const reason = codeOf(error);
        if (reason === 'invalid_code') {
          reset({ name: 'email' });
          setNotice('Pasó demasiado tiempo desde que validaste el código. Pedí uno nuevo para crear tu cuenta.');
        } else if (reason === 'validation_error') {
          setInputError('Escribí tu nombre y apellido.');
        } else {
          setFailure(error);
        }
      }
    });
  }

  const intro =
    returnTo === '/checkout'
      ? 'Ingresá y pagá sin volver a escribir tus datos. La compra queda guardada en tu cuenta.'
      : 'Mirá tus pedidos y en qué estado está cada retiro. Comprá sin volver a escribir tus datos.';

  return (
    <div className={`${container} py-12 sm:py-20`}>
      <div className="mx-auto max-w-md">
        {step.name === 'email' && (
          <>
            <h1 className="text-6xl">Ingresar</h1>
            <p className="mt-3 text-lg text-mute">{intro}</p>
            {session.expired && !notice && (
              <p role="status" className="mt-6 rounded-lg border border-line bg-ink-2 p-4">
                Tu sesión venció. Ingresá de nuevo con tu email.
              </p>
            )}
            {notice && (
              <p role="status" className="mt-6 rounded-lg border border-line bg-ink-2 p-4">
                {notice}
              </p>
            )}
            <form noValidate onSubmit={submitEmail} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor={ids.email} className="block font-semibold">
                  Email
                </label>
                <input
                  id={ids.email}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setInputError(null);
                  }}
                  aria-invalid={Boolean(inputError)}
                  aria-describedby={`${ids.email}-hint${inputError ? ` ${ids.email}-error` : ''}`}
                  className={field}
                />
                <p id={`${ids.email}-hint`} className="text-sm text-mute">
                  Te mandamos un código para entrar. No hace falta contraseña.
                </p>
                {inputError && <FieldError id={`${ids.email}-error`}>{inputError}</FieldError>}
              </div>
              {failure != null && <ErrorNotice error={failure} />}
              <button type="submit" disabled={busy} className={`${button.primary} w-full text-lg`}>
                {busy ? 'Enviando…' : 'Recibir código'}
              </button>
            </form>
          </>
        )}

        {step.name === 'code' && (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-ink-3 text-ember">
              <MailIcon size={28} />
            </span>
            <h1 className="mt-5 text-6xl">Revisá tu email</h1>
            <p className="mt-3 text-lg text-mute">
              Mandamos un código de {CODE_LENGTH} números a <strong className="break-all text-bone">{step.email}</strong>. Vence en{' '}
              {step.minutes} minutos.
            </p>
            {notice && (
              <p role="status" className="mt-6 rounded-lg border border-line bg-ink-2 p-4">
                {notice}
              </p>
            )}
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                submitCode(code);
              }}
              className="mt-8 space-y-5"
            >
              <div className="space-y-2">
                <label htmlFor={ids.code} className="block font-semibold">
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
                    if (digits.length === CODE_LENGTH) submitCode(digits);
                  }}
                  aria-invalid={Boolean(inputError)}
                  aria-describedby={inputError ? `${ids.code}-error` : undefined}
                  className={`${field} h-14 text-center font-display text-4xl tracking-[0.5em]`}
                />
                {inputError && <FieldError id={`${ids.code}-error`}>{inputError}</FieldError>}
              </div>
              {failure != null && <ErrorNotice error={failure} />}
              {busy && (
                <p role="status" className="text-mute">
                  Revisando…
                </p>
              )}
              {!locked && (
                <button type="submit" disabled={busy} className={`${button.primary} w-full text-lg`}>
                  Ingresar
                </button>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={resend} disabled={busy || wait > 0} className={`${locked ? button.primary : button.secondary} flex-1`}>
                  {wait > 0 ? `Pedir otro código en ${wait} s` : locked ? 'Pedir un código nuevo' : 'Reenviar código'}
                </button>
                <button type="button" onClick={() => reset({ name: 'email' })} disabled={busy} className={`${button.ghost} flex-1`}>
                  Usar otro email
                </button>
              </div>
              <p className="text-sm text-mute">¿No llega? Fijate en spam o en promociones.</p>
            </form>
          </>
        )}

        {step.name === 'name' && (
          <>
            <h1 className="text-6xl">Es tu primera vez</h1>
            <p className="mt-3 text-lg text-mute">
              Validamos <strong className="break-all text-bone">{step.email}</strong>. Decinos tu nombre para crear tu cuenta.
            </p>
            <form noValidate onSubmit={submitName} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor={ids.name} className="block font-semibold">
                  Nombre y apellido
                </label>
                <input
                  id={ids.name}
                  autoComplete="name"
                  autoFocus
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setInputError(null);
                  }}
                  aria-invalid={Boolean(inputError)}
                  aria-describedby={inputError ? `${ids.name}-error` : undefined}
                  className={field}
                />
                {inputError && <FieldError id={`${ids.name}-error`}>{inputError}</FieldError>}
              </div>
              {failure != null && <ErrorNotice error={failure} />}
              <button type="submit" disabled={busy} className={`${button.primary} w-full text-lg`}>
                {busy ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
              </button>
            </form>
          </>
        )}

        {returnTo === '/checkout' && step.name === 'email' && (
          <p className="mt-8 text-center text-mute">
            <Link to="/checkout" className="font-semibold text-bone underline underline-offset-4 hover:text-ember-hi">
              Seguir sin cuenta
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
