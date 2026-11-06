import { StorefrontError, type CartLine, type DeliveryAddress, type DeliveryOption, type DeliveryOptions } from '@vertex/storefront-sdk';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { ErrorNotice } from '../components/ErrorNotice';
import { CheckIcon, ClockIcon } from '../components/Icons';
import { field } from '../components/ui';
import { store } from '../content';
import { money } from '../lib/format';
import { useStorefront } from '../lib/storefront';
import {
  EMPTY_ADDRESS,
  PROVINCES,
  addressKey,
  deliveryDays,
  formatAddress,
  isProvince,
  linesDigest,
  shortAddress,
  toDeliveryAddress,
  unavailableReason,
  validateAddress,
  validateContact,
  type AddressForm,
  type ContactForm,
} from './address';

export type Method = 'pickup' | 'carrier';

// Cuánto esperar después del último cambio de la dirección antes de cotizar sola.
export const QUOTE_DELAY_MS = 700;

type Quote =
  | { status: 'idle' }
  | { status: 'quoting' }
  | { status: 'quoted'; key: string; digest: string; address: string; place: DeliveryAddress; options: DeliveryOption[]; unavailable: DeliveryOptions['unavailable'] }
  | { status: 'error'; error: unknown };

type AddressField = keyof AddressForm;

export type Delivery = ReturnType<typeof useDelivery>;

const EMPTY_CONTACT: ContactForm = { phone: '', document: '' };

// offeredByConfig: false si la tienda tiene el envío apagado (VITE_HOME_DELIVERY=off).
export function useDelivery(lines: CartLine[], initialContact: ContactForm = EMPTY_CONTACT, offeredByConfig = true) {
  const storefront = useStorefront();
  const [method, setMethod] = useState<Method>('pickup');
  // Pasa a false si la API responde que el local no hace envíos (404 al cotizar).
  const [offered, setOffered] = useState(offeredByConfig);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [addressTouched, setAddressTouched] = useState<Partial<Record<AddressField, boolean>>>({});
  const [quote, setQuote] = useState<Quote>({ status: 'idle' });
  const [selected, setSelected] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactForm>(initialContact);
  const [contactTouched, setContactTouched] = useState({ phone: false, document: false });
  // La última dirección y carrito que se cotizaron, para no repetir la misma cotización: la API acepta
  // 10 por carrito y minuto, y un error no tiene que reintentarse solo en un bucle.
  const [attempted, setAttempted] = useState<string | null>(null);

  const addressErrors = validateAddress(address);
  const contactErrors = validateContact(contact);
  const current = toDeliveryAddress(address);
  const digest = linesDigest(lines);

  // Una cotización vale para la dirección y las líneas con las que se pidió.
  const stale =
    quote.status !== 'quoted' ? null : !current || addressKey(current) !== quote.key ? 'address' : digest !== quote.digest ? 'cart' : null;
  const carrierOptions = quote.status === 'quoted' ? quote.options.filter((option) => option.kind === 'carrier') : [];
  const chosen = stale ? null : (carrierOptions.find((option) => option.code === selected) ?? null);
  const ready = method === 'pickup' || chosen !== null;
  const quoteKey = current ? `${addressKey(current)}#${digest}` : null;
  // Hay una dirección completa que todavía no se cotizó: la cotización está por salir.
  const pending = method === 'carrier' && offered && quoteKey !== null && quoteKey !== attempted && quote.status !== 'quoting';

  useEffect(() => {
    if (!pending) return;
    // Una sola cotización a la vez: si hay una en curso, esto vuelve a correr cuando termina.
    const timer = setTimeout(() => void requestQuote(false), QUOTE_DELAY_MS);
    return () => clearTimeout(timer);
    // requestQuote lee la dirección y el carrito de este render, que son los de quoteKey.
  }, [pending, quoteKey]);

  function setField(name: AddressField, value: string) {
    setAddress((before) => {
      if (name !== 'province') return { ...before, [name]: value };
      const province = isProvince(value) ? value : '';
      // En CABA la ciudad también se llama CABA.
      const city = province === 'CABA' && before.city.trim() === '' ? 'CABA' : before.city;
      return { ...before, province, city };
    });
  }

  // manual: el comprador la pidió (Enter o «Cotizar de nuevo»); muestra qué falta de la dirección.
  async function requestQuote(manual = true) {
    if (manual) setAddressTouched({ street: true, number: true, postal_code: true, city: true, province: true });
    if (!current || quote.status === 'quoting') return;
    const key = addressKey(current);
    const forDigest = digest;
    setAttempted(`${key}#${forDigest}`);
    setQuote({ status: 'quoting' });
    try {
      const answer = await storefront.getDeliveryOptions(current);
      const carriers = answer.options.filter((option) => option.kind === 'carrier');
      setQuote({ status: 'quoted', key, digest: forDigest, address: formatAddress(current), place: current, options: answer.options, unavailable: answer.unavailable });
      setSelected(carriers.length === 1 ? carriers[0].code : null);
    } catch (error) {
      if (error instanceof StorefrontError && error.code === 'not_found') {
        setOffered(false);
        setMethod('pickup');
        setQuote({ status: 'idle' });
        return;
      }
      setQuote({ status: 'error', error });
    }
  }

  // El checkout respondió shipping_quote_expired: hay que volver a cotizar, sin tocar la dirección.
  function expire(error: StorefrontError) {
    setSelected(null);
    setQuote({ status: 'error', error });
  }

  // Carga la dirección de un checkout que no se pagó, para reintentar sin escribirla de nuevo.
  // Si ya hay una dirección escrita, la deja: es la que el comprador eligió después.
  function restore(place: DeliveryAddress) {
    setAddress((before) => {
      if (Object.values(before).some((value) => value.trim() !== '')) return before;
      return {
        street: place.street,
        number: place.number,
        floor: place.floor ?? '',
        apartment: place.apartment ?? '',
        postal_code: place.postal_code,
        city: place.city,
        province: place.province,
      };
    });
    setMethod('carrier');
  }

  // Después de pagar: la próxima compra empieza de cero.
  function reset() {
    setMethod('pickup');
    setAddress(EMPTY_ADDRESS);
    setAddressTouched({});
    setQuote({ status: 'idle' });
    setSelected(null);
    setContact(EMPTY_CONTACT);
    setContactTouched({ phone: false, document: false });
    setAttempted(null);
  }

  function touchContact() {
    setContactTouched({ phone: true, document: true });
  }

  return {
    method,
    setMethod,
    offered,
    address,
    setField,
    addressErrors,
    addressTouched,
    touchAddress: (name: AddressField) => setAddressTouched((before) => ({ ...before, [name]: true })),
    quote,
    stale,
    pending,
    addressComplete: current !== null,
    carrierOptions,
    selected,
    setSelected,
    chosen,
    ready,
    requestQuote: () => requestQuote(true),
    expire,
    restore,
    reset,
    contact,
    setContact,
    contactErrors,
    contactTouched,
    touchContactField: (name: keyof ContactForm) => setContactTouched((before) => ({ ...before, [name]: true })),
    touchContact,
  };
}

// Lo mismo que `field`, un poco más bajo: el formulario de la dirección tiene muchos campos.
const input = field.replace('h-12', 'h-11');
const label = 'mb-1.5 block text-sm text-bone/80';
// Los h3 heredan Bebas con trazo (index.css); acá van en Rajdhani sin trazo.
const sectionTitle = 'font-ui text-sm font-bold uppercase leading-tight tracking-[0.1em] text-bone/85 [-webkit-text-stroke:0]';
const choiceCard =
  'flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-ink-2 px-4 py-3.5 transition-colors hover:border-mute has-[:checked]:border-ember has-[:checked]:bg-ember/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember';
const secondaryButton = 'h-11 rounded-md border border-line px-4 font-semibold hover:border-mute';

const CARRIER_NAMES: Record<NonNullable<DeliveryOption['carrier']>, string> = { andreani: 'Andreani' };

type TextField = 'street' | 'number' | 'floor' | 'apartment' | 'postal_code' | 'city';

export function DeliveryChoice({ delivery, disabled }: { delivery: Delivery; disabled: boolean }) {
  const ids = {
    street: useId(),
    number: useId(),
    floor: useId(),
    apartment: useId(),
    postal_code: useId(),
    city: useId(),
    province: useId(),
    phone: useId(),
    document: useId(),
  };
  const { method, quote, stale, chosen } = delivery;
  const quoting = quote.status === 'quoting';

  function quoteOnEnter(event: KeyboardEvent) {
    if (event.key !== 'Enter' || (event.target as HTMLElement).tagName === 'BUTTON') return;
    event.preventDefault();
    void delivery.requestQuote();
  }

  function addressInput(name: TextField, text: string, extra: { autoComplete?: string; placeholder?: string; ariaLabel?: string } = {}) {
    const error = (delivery.addressErrors as Record<string, string | undefined>)[name];
    const showError = Boolean(delivery.addressTouched[name] && error);
    return (
      <div>
        <label htmlFor={ids[name]} className={label}>
          {text}
        </label>
        <input
          id={ids[name]}
          name={name}
          autoComplete={extra.autoComplete}
          placeholder={extra.placeholder}
          aria-label={extra.ariaLabel}
          value={delivery.address[name]}
          onChange={(event) => delivery.setField(name, event.target.value)}
          onBlur={() => delivery.touchAddress(name)}
          aria-invalid={showError}
          aria-describedby={showError ? `${ids[name]}-error` : undefined}
          className={input}
        />
        {showError && (
          <p id={`${ids[name]}-error`} className="mt-1 text-xs text-alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const provinceError = delivery.addressTouched.province ? delivery.addressErrors.province : undefined;
  const carrierName = chosen?.carrier ? CARRIER_NAMES[chosen.carrier] : 'El transporte';

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-3 text-lg font-semibold">¿Cómo lo recibís?</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={choiceCard}>
          <input type="radio" name="metodo" value="pickup" checked={method === 'pickup'} onChange={() => delivery.setMethod('pickup')} className="mt-1 size-4 shrink-0 accent-ember" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Retiro en el local</span>
            <span className="block text-sm text-mute">{store.address}</span>
          </span>
          <span className="font-semibold text-moss">Gratis</span>
        </label>
        {delivery.offered && (
          <label className={choiceCard}>
            <input type="radio" name="metodo" value="carrier" checked={method === 'carrier'} onChange={() => delivery.setMethod('carrier')} className="mt-1 size-4 shrink-0 accent-ember" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Envío a domicilio</span>
              <span className="block text-sm text-mute">Por Andreani, a todo el país</span>
            </span>
            {chosen && <span className="font-semibold tabular-nums">{money(chosen.price, chosen.currency)}</span>}
          </label>
        )}
      </div>

      {!delivery.offered && (
        <p role="status" className="text-sm text-mute">
          Por ahora no hacemos envíos a domicilio: retirás tu compra en el local.
        </p>
      )}

      {method === 'pickup' && (
        <p id="retiro" className="flex items-start gap-2 text-sm text-mute">
          <ClockIcon size={16} className="mt-0.5 shrink-0" />
          <span>
            Retirás cuando el pago esté aprobado, con tu número de pedido. {store.hours.map((slot) => `${slot.days}: ${slot.time}`).join('. ')}.
          </span>
        </p>
      )}

      {method === 'carrier' && (
        <div className="divide-y divide-line rounded-lg border border-line bg-ink-2 px-4 sm:px-5">
          <section aria-labelledby={`${ids.street}-titulo`} onKeyDown={quoteOnEnter} className="space-y-3 py-5">
            <h3 id={`${ids.street}-titulo`} className={sectionTitle}>
              1 · Dirección
            </h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
              <div className="col-span-3 sm:col-span-1">{addressInput('street', 'Calle', { autoComplete: 'address-line1' })}</div>
              {addressInput('number', 'Altura')}
              {addressInput('floor', 'Piso', { placeholder: 'Opc.' })}
              {addressInput('apartment', 'Depto', { placeholder: 'Opc.' })}
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3 sm:grid-cols-[1fr_2fr_3fr]">
              {addressInput('postal_code', 'CP', { autoComplete: 'postal-code', ariaLabel: 'Código postal' })}
              {addressInput('city', 'Ciudad o localidad', { autoComplete: 'address-level2' })}
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={ids.province} className={label}>
                  Provincia
                </label>
                <select
                  id={ids.province}
                  name="province"
                  autoComplete="address-level1"
                  value={delivery.address.province}
                  onChange={(event) => delivery.setField('province', event.target.value)}
                  onBlur={() => delivery.touchAddress('province')}
                  aria-invalid={Boolean(provinceError)}
                  aria-describedby={provinceError ? `${ids.province}-error` : undefined}
                  className={input}
                >
                  <option value="">Elegí una provincia</option>
                  {PROVINCES.map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
                {provinceError && (
                  <p id={`${ids.province}-error`} className="mt-1 text-xs text-alert">
                    {provinceError}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby={`${ids.number}-titulo`} className="space-y-3 py-5" aria-live="polite">
            <h3 id={`${ids.number}-titulo`} className={sectionTitle}>
              2 · Envío
            </h3>

            {(quoting || delivery.pending) && (
              <p role="status" className="flex items-center gap-2 text-sm text-mute">
                <span className="size-4 animate-spin rounded-full border-2 border-line border-t-ember" aria-hidden="true" />
                Cotizando el envío…
              </p>
            )}

            {!quoting && !delivery.addressComplete && quote.status !== 'error' && (
              <p className="text-sm text-mute">Completá calle, altura, código postal, ciudad y provincia, y te mostramos el costo del envío.</p>
            )}

            {quote.status === 'error' && !delivery.pending && (
              <ErrorNotice error={quote.error} context="quote">
                <button type="button" onClick={() => void delivery.requestQuote()} className="h-11 rounded-md bg-ember px-4 font-semibold text-ink">
                  Cotizar de nuevo
                </button>
                <button type="button" onClick={() => delivery.setMethod('pickup')} className={secondaryButton}>
                  Retirar en el local
                </button>
              </ErrorNotice>
            )}

            {quote.status === 'quoted' && stale && delivery.addressComplete && !delivery.pending && (
              <button type="button" onClick={() => void delivery.requestQuote()} className={secondaryButton}>
                Cotizar de nuevo
              </button>
            )}

            {quote.status === 'quoted' && !stale && (
              <>
                {delivery.carrierOptions.length > 0 && (
                  <div role="radiogroup" aria-label="Opciones de envío" className="space-y-2">
                    {delivery.carrierOptions.map((option) => (
                      <label key={option.code} className={`${choiceCard} items-center`}>
                        <input
                          type="radio"
                          name="opcion-envio"
                          value={option.code}
                          checked={delivery.selected === option.code}
                          onChange={() => delivery.setSelected(option.code)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-transparent peer-checked:border-ember peer-checked:bg-ember peer-checked:text-ember-ink"
                        >
                          <CheckIcon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{option.name}</span>
                          <span className="block text-sm text-mute">{shortAddress(quote.place)}</span>
                          {deliveryDays(option.delivery_days) && <span className="block text-sm text-mute">{deliveryDays(option.delivery_days)}</span>}
                        </span>
                        <span className="font-semibold tabular-nums">{money(option.price, option.currency)}</span>
                      </label>
                    ))}
                  </div>
                )}
                {quote.unavailable.map((entry) => (
                  <p key={entry.carrier} className="rounded-lg border border-line p-3 text-sm text-mute">
                    {unavailableReason(entry)}
                  </p>
                ))}
                {delivery.carrierOptions.length === 0 && (
                  <button type="button" onClick={() => delivery.setMethod('pickup')} className={secondaryButton}>
                    Retirar en el local
                  </button>
                )}
              </>
            )}
          </section>

          {chosen && (
            <section aria-labelledby={`${ids.phone}-titulo`} className="space-y-3 py-5">
              <div>
                <h3 id={`${ids.phone}-titulo`} className={sectionTitle}>
                  3 · Contacto para la entrega
                </h3>
                <p className="mt-1 text-sm text-mute">{carrierName} los usa para avisarte y entregar el paquete.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['phone', 'Teléfono', 'tel', 'tel', '11 2345 6789'],
                    ['document', 'DNI', 'off', 'numeric', 'Sin puntos'],
                  ] as const
                ).map(([name, text, autoComplete, inputMode, placeholder]) => {
                  const error = delivery.contactTouched[name] ? delivery.contactErrors[name] : undefined;
                  return (
                    <div key={name}>
                      <label htmlFor={ids[name]} className={label}>
                        {text}
                      </label>
                      <input
                        id={ids[name]}
                        name={name}
                        type={name === 'phone' ? 'tel' : 'text'}
                        autoComplete={autoComplete}
                        inputMode={inputMode}
                        placeholder={placeholder}
                        value={delivery.contact[name]}
                        onChange={(event) => delivery.setContact({ ...delivery.contact, [name]: event.target.value })}
                        onBlur={() => delivery.touchContactField(name)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${ids[name]}-error` : undefined}
                        className={input}
                      />
                      {error && (
                        <p id={`${ids[name]}-error`} className="mt-1 text-xs text-alert">
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </fieldset>
  );
}
