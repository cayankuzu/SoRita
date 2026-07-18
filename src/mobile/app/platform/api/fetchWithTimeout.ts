import { tr } from '@/mobile/app/shared/i18n/tr';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isTimeout = false,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export type FetchWithTimeoutOptions = RequestInit & {
  retries?: number;
  retryDelay?: number;
  timeoutMs?: number;
};

/**
 * Fetch wrapper with automatic timeout, retry, and error classification.
 * Handles flaky connections gracefully — essential for mobile apps.
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const {
    retries = MAX_RETRIES,
    retryDelay = RETRY_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      // Don't retry client errors (except retryable ones)
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === retries) {
        throw new NetworkError(
          tr.system.requestFailed(response.status),
          response.status,
        );
      }

      lastError = new NetworkError(
        tr.system.requestFailed(response.status),
        response.status,
      );
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof NetworkError) {
        throw error;
      }

      const isAbort =
        error instanceof DOMException && error.name === 'AbortError';

      if (isAbort) {
        lastError = new NetworkError(tr.system.connectionSlow, undefined, true);
      } else {
        lastError = new NetworkError(
          tr.system.connectionUnavailable,
          undefined,
          false,
        );
      }

      if (attempt === retries) {
        throw lastError;
      }
    }

    // Wait before retry with exponential backoff
    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt)),
      );
    }
  }

  throw lastError ?? new NetworkError(tr.system.connectionUnavailable);
}
