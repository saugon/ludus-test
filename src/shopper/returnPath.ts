export const ACCOUNT_PATH = '/cuenta';
export const SIGN_IN_PATH = '/ingresar';

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return ACCOUNT_PATH;
  if (value === SIGN_IN_PATH || value.startsWith(`${SIGN_IN_PATH}?`)) return ACCOUNT_PATH;
  return value;
}

export function signInPath(returnTo: string): string {
  return `${SIGN_IN_PATH}?volver=${encodeURIComponent(returnTo)}`;
}
