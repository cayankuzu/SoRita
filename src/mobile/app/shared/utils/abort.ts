export function createAbortError(message = 'Operation cancelled') {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }

  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();

  return (
    error.name === 'AbortError' ||
    normalizedMessage.includes('aborterror') ||
    normalizedMessage.includes('aborted') ||
    normalizedMessage.includes('cancelled') ||
    normalizedMessage.includes('canceled')
  );
}

export function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

export async function waitWithAbort(milliseconds: number, signal?: AbortSignal | null) {
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
    return;
  }

  if (signal.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, milliseconds);

    const handleAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', handleAbort);
      reject(createAbortError());
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}
