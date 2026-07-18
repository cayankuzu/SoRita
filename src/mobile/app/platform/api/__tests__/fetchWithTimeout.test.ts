import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tr } from '@/mobile/app/shared/i18n/tr';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns the underlying response when the request completes in time', async () => {
    const response = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    const { fetchWithTimeout } = await import('@/mobile/app/platform/api/fetchWithTimeout');

    await expect(fetchWithTimeout('https://example.com', { timeoutMs: 25 })).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('rejects with a readable timeout error when the request hangs', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortError = new DOMException('aborted', 'AbortError');
            reject(abortError);
          });
        }),
      ),
    );

    const { fetchWithTimeout } = await import('@/mobile/app/platform/api/fetchWithTimeout');
    const requestPromise = fetchWithTimeout('https://example.com', { retries: 0, timeoutMs: 25 });
    const settledPromise = requestPromise.catch((error) => error);

    await vi.advanceTimersByTimeAsync(25);

    await expect(settledPromise).resolves.toMatchObject({
      message: tr.system.connectionSlow,
    });
  });
});
