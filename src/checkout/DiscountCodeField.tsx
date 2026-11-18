import { useId, useState } from 'react';
import { useCart } from '../cart/CartProvider';
import { field } from '../components/ui';
import { cartCode, cartCodeError, discountCodeFailure, discountCodeReason } from '../payment/discountCode';

const linkButton = 'text-sm font-semibold text-mute underline underline-offset-4 hover:text-bone disabled:cursor-not-allowed disabled:opacity-50';

// El código de descuento, en el resumen de los pasos de la compra. Va dentro del formulario del paso Pago: no
// puede ser otro <form>, así que Enter en el campo aplica el código en lugar de enviar el pago.
export function DiscountCodeField() {
  const cart = useCart();
  const inputId = useId();
  const messageId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Un backend sin códigos de descuento no manda los campos: no hay nada que ofrecer.
  if (!cart.cart || !('total_with_discount_code' in cart.cart)) return null;

  const code = cartCode(cart.cart);
  const codeError = cartCodeError(cart.cart);

  async function apply() {
    const typed = value.trim();
    if (!typed) {
      setFailure('Escribí el código.');
      return;
    }
    setBusy(true);
    setFailure(null);
    const error = await cart.applyCode(typed);
    setBusy(false);
    if (error) {
      setFailure(discountCodeFailure(error));
      return;
    }
    setValue('');
    setOpen(false);
  }

  async function remove() {
    setBusy(true);
    setFailure(null);
    const error = await cart.removeCode();
    setBusy(false);
    if (error) setFailure(discountCodeFailure(error));
  }

  if (code) {
    return (
      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-mute">
            Código <span className="break-all font-semibold text-bone">{code.code}</span>
          </p>
          <button type="button" onClick={() => void remove()} disabled={busy || cart.saving} className={linkButton} aria-label={`Quitar el código ${code.code}`}>
            {busy ? 'Quitando…' : 'Quitar'}
          </button>
        </div>
        {codeError && (
          <p role="alert" className="mt-1.5 text-sm text-alert">
            {discountCodeReason(codeError)} Quitalo para poder pagar.
          </p>
        )}
        {failure && (
          <p role="alert" className="mt-1.5 text-sm text-alert">
            {failure}
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-4 border-t border-line pt-4">
        <button type="button" onClick={() => setOpen(true)} className={linkButton}>
          ¿Tenés un código de descuento?
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <label htmlFor={inputId} className="text-sm font-semibold text-bone">
        Código de descuento
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={inputId}
          name="discount-code"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setFailure(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            void apply();
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          aria-invalid={failure ? true : undefined}
          aria-describedby={failure ? messageId : undefined}
          className={`${field} min-w-0 flex-1 uppercase placeholder:normal-case`}
          placeholder="Ej.: BIENVENIDA10"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy || cart.saving}
          className="h-12 shrink-0 rounded-md border border-line px-4 font-semibold text-bone hover:border-mute disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {failure && (
        <p id={messageId} role="alert" className="mt-1.5 text-sm text-alert">
          {failure}
        </p>
      )}
    </div>
  );
}
