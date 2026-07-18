/**
 * Input validation helpers shared between mobile and backend.
 * Pure functions, zero dependencies.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER_REGEX = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidUsername(username: string): boolean {
  const trimmed = username.trim().toLowerCase();
  return trimmed.length >= 3 && trimmed.length <= 30 && USERNAME_REGEX.test(trimmed);
}

export function isWithinLength(value: string, min: number, max: number): boolean {
  const len = value.trim().length;
  return len >= min && len <= max;
}

export function sanitizeText(input: string): string {
  return input.replace(CONTROL_CHARACTER_REGEX, '').trim();
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Validate a UUID v4 format.
 */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
