const formatters = new Map<string, Intl.NumberFormat>();

// Sin centavos cuando el monto es entero ($ 15.650); con los dos dígitos cuando los tiene ($ 4.428,50).
function formatter(currency: string, cents: boolean): Intl.NumberFormat {
  const key = `${currency}:${cents}`;
  let current = formatters.get(key);
  if (!current) {
    current = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    formatters.set(key, current);
  }
  return current;
}

export function money(amount: string | null | undefined, currency: string | null | undefined = 'ARS'): string {
  if (amount === null || amount === undefined || amount === '') return 'Consultar';
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  try {
    return formatter(currency || 'ARS', !Number.isInteger(Math.round(value * 100) / 100)).format(value);
  } catch {
    return `$ ${value.toLocaleString('es-AR')}`;
  }
}

// Fechas sin hora de la API (YYYY-MM-DD): se leen en UTC para que la zona horaria no las corra un día.
function dateParts(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «15 dic», con el año si no es el actual («15 ene 2027»); `long`: «15 de diciembre». `null` si la fecha no es válida. */
export function shortDate(iso: string, { long = false, today = new Date() }: { long?: boolean; today?: Date } = {}): string | null {
  const date = dateParts(iso);
  if (!date) return null;
  const withYear = date.getUTCFullYear() !== today.getFullYear();
  if (long) {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' }).format(date);
  }
  // Intl arma «15 de dic de 2026»; en la pastilla va más corto.
  const month = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' }).format(date).replace(/\.$/, '');
  return `${date.getUTCDate()} ${month}${withYear ? ` ${date.getUTCFullYear()}` : ''}`;
}
