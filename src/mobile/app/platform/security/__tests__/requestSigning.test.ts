import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

vi.mock('@/mobile/app/platform/storage/deviceId', () => ({
  getOrCreateDeviceId: vi.fn().mockResolvedValue('device-1234'),
}));

import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';

describe('request signing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates unique replay-protection nonces for parallel requests in the same millisecond', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_786_909_600_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const headers = await Promise.all(
      Array.from({ length: 12 }, () =>
        createSignedEdgeHeaders({
          accessToken: 'session-token',
          bodyText: '{"action":"create-upload-url"}',
          functionName: 'media-assets',
        })),
    );
    const nonces = headers.map((item) => item['x-nonce']);

    expect(new Set(nonces).size).toBe(nonces.length);
    nonces.forEach((nonce) => {
      expect(nonce).toMatch(/^[a-zA-Z0-9-]{16,128}$/);
    });
  });

  it('can sign the legacy protocol for an older deployed edge function', async () => {
    const timestamp = 1_786_909_600_000;
    const bodyText = '{"action":"upload"}';
    vi.spyOn(Date, 'now').mockReturnValue(timestamp);

    const headers = await createSignedEdgeHeaders({
      accessToken: 'session-token',
      bodyText,
      functionName: 'media-assets',
      legacy: true,
    });
    const payloadHash = bytesToHex(sha256(utf8ToBytes(bodyText)));
    const expectedSignature = bytesToHex(
      hmac(
        sha256,
        utf8ToBytes('session-token'),
        utf8ToBytes(
          `device-1234:${timestamp}:${headers['x-nonce']}:${payloadHash}`,
        ),
      ),
    );

    expect(headers['x-signature']).toBe(expectedSignature);
  });
});
