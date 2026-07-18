import { t } from '@/mobile/app/shared/i18n';

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }

  if (typeof error === 'string') {
    return error.trim();
  }

  return '';
}

export function isLikelyTimeoutError(error: unknown) {
  const message = normalizeErrorMessage(error).toLowerCase();

  return (
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('aborterror')
  );
}

export function isLikelyNetworkError(error: unknown) {
  const message = normalizeErrorMessage(error).toLowerCase();

  return (
    isLikelyTimeoutError(message) ||
    message.includes('network request failed') ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('offline') ||
    message.includes('internet')
  );
}

export function getUserFacingErrorMessage(error: unknown, fallbackMessage: string) {
  const message = normalizeErrorMessage(error);

  if (!message) {
    return fallbackMessage;
  }

  if (isLikelyTimeoutError(message)) {
    return t.system.connectionSlow;
  }

  if (isLikelyNetworkError(message)) {
    return t.system.connectionUnavailable;
  }

  if (message.length > 160) {
    return fallbackMessage;
  }

  return message;
}
