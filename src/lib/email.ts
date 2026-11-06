const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export const EMAIL_ERROR = 'Escribí un email válido, por ejemplo nombre@gmail.com.';
