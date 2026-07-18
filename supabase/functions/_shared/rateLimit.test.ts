import { describe, expect, it } from 'vitest';

import { enforceRateLimit } from './rateLimit';

describe('rateLimit', () => {
  it('tracks fallback limits separately for each scope', async () => {
    const identifier = `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const uploadResult = await enforceRateLimit({
      identifier,
      maxRequests: 1,
      scope: 'media:upload',
      windowMs: 60_000,
    });
    const createUploadUrlResult = await enforceRateLimit({
      identifier,
      maxRequests: 1,
      scope: 'media:create-upload-url',
      windowMs: 60_000,
    });
    const repeatedUploadResult = await enforceRateLimit({
      identifier,
      maxRequests: 1,
      scope: 'media:upload',
      windowMs: 60_000,
    });

    expect(uploadResult.allowed).toBe(true);
    expect(createUploadUrlResult.allowed).toBe(true);
    expect(repeatedUploadResult.allowed).toBe(false);
  });
});
