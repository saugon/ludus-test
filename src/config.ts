export const CONFIG_VARS = {
  baseUrl: 'VITE_STOREFRONT_BASE_URL',
  venue: 'VITE_STOREFRONT_VENUE',
  publishableKey: 'VITE_STOREFRONT_KEY',
} as const;

// Opcional: off (o false, 0, no) oculta el envío a domicilio, para un backend que todavía no lo tiene.
export const HOME_DELIVERY_VAR = 'VITE_HOME_DELIVERY';

export type StoreConfig = { baseUrl: string; venue: string; publishableKey: string; homeDelivery: boolean };

function readSwitch(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return !['off', 'false', '0', 'no'].includes((value ?? '').trim().toLowerCase());
}

export type ConfigResult =
  | { ok: true; config: StoreConfig }
  | { ok: false; missing: string[] };

export function readConfig(env: Record<string, string | boolean | undefined>): ConfigResult {
  const entries = Object.entries(CONFIG_VARS).map(([field, name]) => {
    const value = env[name];
    return [field, name, typeof value === 'string' ? value.trim() : ''] as const;
  });

  const missing = entries.filter(([, , value]) => value === '').map(([, name]) => name);
  if (missing.length > 0) return { ok: false, missing };

  const values = Object.fromEntries(entries.map(([field, , value]) => [field, value])) as Omit<StoreConfig, 'homeDelivery'>;
  const config: StoreConfig = { ...values, homeDelivery: readSwitch(env[HOME_DELIVERY_VAR]) };
  return { ok: true, config };
}
