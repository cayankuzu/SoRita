const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...requestInit } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
