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
