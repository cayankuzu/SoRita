import { describe, expect, it, vi } from 'vitest';

import {
  buildRequestSigningMessage,
  createRequestSignature,
  sha256Hex,
  verifySignedRequest,
} from './requestSecurity';

function createAdminClient(options?: {
  insertError?: { code?: string; message: string } | null;
}) {
  const deleteExpiredMock = vi.fn().mockResolvedValue({ error: null });
  const insertMock = vi.fn().mockResolvedValue({ error: options?.insertError ?? null });

  return {
    adminClient: {
      from: () => ({
        delete: () => ({
          lt: deleteExpiredMock,
        }),
        insert: insertMock,
      }),
    },
    deleteExpiredMock,
    insertMock,
  };
}

async function createSignedRequest(body: string) {
  const deviceId = 'device-1234';
  const nonce = 'nonce-1234-5678-90ab';
  const timestamp = Date.now().toString();
  const payloadHash = await sha256Hex(body);
  const signature = await createRequestSignature('token-1', {
    deviceId,
    nonce,
    payloadHash,
    timestamp,
  });

  return new Request('https://example.supabase.co/functions/v1/media-assets', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-1',
      'x-device-id': deviceId,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-timestamp': timestamp,
    },
    body,
  });
}

describe('requestSecurity', () => {
  it('builds stable signing messages and hashes', async () => {
    expect(
      buildRequestSigningMessage({
        deviceId: 'device-1',
        nonce: 'nonce-1',
        payloadHash: 'hash-1',
        timestamp: '100',
      }),
    ).toBe('device-1:100:nonce-1:hash-1');
    await expect(sha256Hex('hello')).resolves.toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('verifies valid requests and persists the nonce', async () => {
    const { adminClient, deleteExpiredMock, insertMock } = createAdminClient();
    const request = await createSignedRequest(JSON.stringify({ hello: 'world' }));

    const result = await verifySignedRequest({
      adminClient,
      functionName: 'media-assets',
      request,
      token: 'token-1',
      userId: 'user-1',
    });

    expect(result).toMatchObject({
      bodyText: JSON.stringify({ hello: 'world' }),
      ok: true,
    });
    expect(deleteExpiredMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        device_id: 'device-1234',
        function_name: 'media-assets',
        nonce: 'nonce-1234-5678-90ab',
        user_id: 'user-1',
      }),
    );
  });

  it('rejects missing headers, expired timestamps, tampering, and replay', async () => {
    const missingHeadersResult = await verifySignedRequest({
      adminClient: createAdminClient().adminClient,
      functionName: 'media-assets',
      request: new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        body: '{}',
      }),
      token: 'token-1',
      userId: 'user-1',
    });
    expect(missingHeadersResult).toMatchObject({
      error: 'Missing or invalid request signature headers',
      ok: false,
      status: 401,
    });

    const expiredBody = '{}';
    const expiredPayloadHash = await sha256Hex(expiredBody);
    const expiredSignature = await createRequestSignature('token-1', {
      deviceId: 'device-1234',
      nonce: 'nonce-1234-5678-90ab',
      payloadHash: expiredPayloadHash,
      timestamp: '1',
    });
    const expiredRequest = new Request('https://example.supabase.co/functions/v1/media-assets', {
      method: 'POST',
      headers: {
        'x-device-id': 'device-1234',
        'x-nonce': 'nonce-1234-5678-90ab',
        'x-signature': expiredSignature,
        'x-timestamp': '1',
      },
      body: expiredBody,
    });

    const expiredResult = await verifySignedRequest({
      adminClient: createAdminClient().adminClient,
      functionName: 'media-assets',
      request: expiredRequest,
      token: 'token-1',
      userId: 'user-1',
    });
    expect(expiredResult).toMatchObject({
      error: 'Request timestamp expired',
      ok: false,
      status: 401,
    });

    const tamperedRequest = await createSignedRequest(JSON.stringify({ hello: 'world' }));
    const tamperedResult = await verifySignedRequest({
      adminClient: createAdminClient().adminClient,
      functionName: 'media-assets',
      request: new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: tamperedRequest.headers,
        body: JSON.stringify({ hello: 'tampered' }),
      }),
      token: 'token-1',
      userId: 'user-1',
    });
    expect(tamperedResult).toMatchObject({
      error: 'Request signature verification failed',
      ok: false,
      status: 401,
    });

    const replayResult = await verifySignedRequest({
      adminClient: createAdminClient({
        insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
      }).adminClient,
      functionName: 'media-assets',
      request: await createSignedRequest('{}'),
      token: 'token-1',
      userId: 'user-1',
    });
    expect(replayResult).toMatchObject({
      error: 'Replay detected',
      ok: false,
      status: 409,
    });
  });
});
