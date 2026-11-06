import type { CartLine, DeliveryAddress, DeliveryOptions } from '@vertex/storefront-sdk';

export type Province = DeliveryAddress['province'];

// Un Record sobre el tipo del SDK: si la API suma o cambia una jurisdicción, esto deja de compilar.
const PROVINCE_NAMES: Record<Province, string> = {
  CABA: 'Ciudad de Buenos Aires (CABA)',
  'Buenos Aires': 'Buenos Aires',
  Catamarca: 'Catamarca',
  Chaco: 'Chaco',
  Chubut: 'Chubut',
  Córdoba: 'Córdoba',
  Corrientes: 'Corrientes',
  'Entre Ríos': 'Entre Ríos',
  Formosa: 'Formosa',
  Jujuy: 'Jujuy',
  'La Pampa': 'La Pampa',
  'La Rioja': 'La Rioja',
  Mendoza: 'Mendoza',
  Misiones: 'Misiones',
  Neuquén: 'Neuquén',
  'Río Negro': 'Río Negro',
  Salta: 'Salta',
  'San Juan': 'San Juan',
  'San Luis': 'San Luis',
  'Santa Cruz': 'Santa Cruz',
  'Santa Fe': 'Santa Fe',
  'Santiago del Estero': 'Santiago del Estero',
  'Tierra del Fuego': 'Tierra del Fuego',
  Tucumán: 'Tucumán',
};

export const PROVINCES = Object.entries(PROVINCE_NAMES) as [Province, string][];

export function isProvince(value: string): value is Province {
  return Object.hasOwn(PROVINCE_NAMES, value);
}

export type AddressForm = {
  street: string;
  number: string;
  floor: string;
  apartment: string;
  postal_code: string;
  city: string;
  province: Province | '';
};

export const EMPTY_ADDRESS: AddressForm = { street: '', number: '', floor: '', apartment: '', postal_code: '', city: '', province: '' };

export type AddressErrors = Partial<Record<'street' | 'number' | 'postal_code' | 'city' | 'province', string>>;

// Acepta el código postal de 4 dígitos o el CPA completo (C1425ABC) y se queda con los 4 dígitos.
export function postalCode(value: string): string | null {
  const match = /^[A-Za-z]?(\d{4})[A-Za-z]{0,3}$/.exec(value.trim());
  return match ? match[1] : null;
}

export function validateAddress(form: AddressForm): AddressErrors {
  const errors: AddressErrors = {};
  if (form.street.trim().length < 2) errors.street = 'Escribí la calle.';
  if (form.number.trim() === '') errors.number = 'Escribí la altura.';
  if (!postalCode(form.postal_code)) errors.postal_code = 'El código postal tiene 4 dígitos, por ejemplo 1425.';
  if (form.city.trim().length < 2) errors.city = 'Escribí la ciudad o localidad.';
  if (form.province === '') errors.province = 'Elegí la provincia.';
  return errors;
}

export function toDeliveryAddress(form: AddressForm): DeliveryAddress | null {
  const code = postalCode(form.postal_code);
  if (!code || form.province === '' || Object.keys(validateAddress(form)).length > 0) return null;
  const floor = form.floor.trim();
  const apartment = form.apartment.trim();
  return {
    street: form.street.trim(),
    number: form.number.trim(),
    ...(floor ? { floor } : {}),
    ...(apartment ? { apartment } : {}),
    postal_code: code,
    city: form.city.trim(),
    province: form.province,
  };
}

// Identifica una dirección para saber si la cotización sigue siendo de la que está escrita.
export function addressKey(address: DeliveryAddress): string {
  return [address.street, address.number, address.floor ?? '', address.apartment ?? '', address.postal_code, address.city, address.province]
    .map((part) => part.toLowerCase())
    .join('|');
}

// Identifica las líneas del carrito: el backend invalida la cotización si cambian.
export function linesDigest(lines: Pick<CartLine, 'code' | 'quantity'>[]): string {
  return lines.map((line) => `${line.code}:${line.quantity}`).join(',');
}

export function formatAddress(address: DeliveryAddress): string {
  const parts = [`${address.street} ${address.number}`];
  if (address.floor) parts.push(`piso ${address.floor}`);
  if (address.apartment) parts.push(`depto ${address.apartment}`);
  parts.push(address.city);
  if (address.province !== address.city) parts.push(address.province);
  return `${parts.join(', ')} (CP ${address.postal_code})`;
}

// La versión corta, para una línea: «Berthelot 3356 · CABA (CP 1431)».
export function shortAddress(address: DeliveryAddress): string {
  const line = [`${address.street} ${address.number}`, address.floor && `piso ${address.floor}`, address.apartment && `depto ${address.apartment}`]
    .filter(Boolean)
    .join(', ');
  const place = address.province !== address.city ? `${address.city}, ${address.province}` : address.city;
  return `${line} · ${place} (CP ${address.postal_code})`;
}

export type ContactForm = { phone: string; document: string };
export type ContactErrors = Partial<Record<keyof ContactForm, string>>;

export function validateContact({ phone, document }: ContactForm): ContactErrors {
  const errors: ContactErrors = {};
  const digits = phone.trim().replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (!/^\d{8,15}$/.test(digits)) errors.phone = 'Escribí un teléfono con código de área, por ejemplo 11 2345 6789.';
  if (!/^\d{7,8}$/.test(document.trim().replace(/\./g, ''))) errors.document = 'Escribí tu DNI, de 7 u 8 números.';
  return errors;
}

const CARRIERS: Record<DeliveryOptions['unavailable'][number]['carrier'], string> = { andreani: 'Andreani' };

export function unavailableReason({ carrier, reason }: DeliveryOptions['unavailable'][number]): string {
  const name = CARRIERS[carrier] ?? carrier;
  return reason === 'address_not_served'
    ? `${name} no llega a esta dirección. Revisá el código postal o retirá en el local.`
    : `El envío con ${name} no está disponible en este momento. Probá más tarde o retirá en el local.`;
}

export function deliveryDays(days: number | null): string | null {
  if (days == null) return null;
  return days === 1 ? 'Llega en 1 día aprox.' : `Llega en ${days} días aprox.`;
}

export function addAmounts(a: string | null | undefined, b: string | null | undefined): string | null {
  const sum = Number(a) + Number(b);
  if (a == null || b == null || !Number.isFinite(sum)) return null;
  return (Math.round(sum * 100) / 100).toFixed(2);
}
