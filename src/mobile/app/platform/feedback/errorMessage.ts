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
    return 'Baglanti gec yanit veriyor. Lutfen tekrar dene.';
  }

  if (isLikelyNetworkError(message)) {
    return 'Internet baglantisi su an kullanilamiyor. Baglantini kontrol edip tekrar dene.';
  }

  if (message.length > 160) {
    return fallbackMessage;
  }

  return message;
}
