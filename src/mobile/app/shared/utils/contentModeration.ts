import { tr } from '@/mobile/app/shared/i18n/tr';

const BLOCKED_EXPRESSIONS = [
  'amk',
  'ananisikeyim',
  'asshole',
  'bitch',
  'fuck',
  'nigga',
  'nigger',
  'orospu',
  'pic',
  'porno',
  'porn',
  'sex',
  'shit',
  'sik',
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExpressionMatcher(expression: string) {
  const normalizedExpression = normalizeText(expression).replace(/\s+/g, '');

  if (!normalizedExpression) {
    return null;
  }

  const lettersPattern = normalizedExpression
    .split('')
    .map((character) => escapeRegex(character))
    .join('\\s*');

  return new RegExp(`(^|\\s)${lettersPattern}(?=$|\\s)`);
}

export function containsObjectionableContent(value?: string | null) {
  if (!value?.trim()) {
    return false;
  }

  const normalized = normalizeText(value);

  return BLOCKED_EXPRESSIONS.some((expression) => buildExpressionMatcher(expression)?.test(normalized));
}

export function assertNoObjectionableContent(fields: Array<{ label: string; value?: string | null }>) {
  const blockedField = fields.find((field) => containsObjectionableContent(field.value));

  if (!blockedField) {
    return;
  }

  throw new Error(tr.moderation.objectionableContent(blockedField.label));
}
