import { describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createDeleteUserHandler } from './handler';

function createDeps(options?: {
  claimsResult?: {
    data?: { claims?: { sub?: string } | null } | null;
    error?: { message: string } | null;
  };
  config?: {
    supabasePublishableKey?: string;
    supabaseServiceRoleKey?: string;
    supabaseUrl?: string;
  };
  deleteNotificationsError?: { message: string } | null;
  deleteUserError?: { message: string } | null;
  listError?: { message: string } | null;
  nonceInsertError?: { code?: string; message: string } | null;
  removeError?: { message: string } | null;
}) {
  const getClaimsMock = vi.fn().mockResolvedValue(options?.claimsResult ?? {
    data: {
      claims: {
        sub: 'user-1',
      },
    },
    error: null,
  });
  const listMock = vi.fn().mockResolvedValue({ data: [], error: options?.listError ?? null });
  const removeMock = vi.fn().mockResolvedValue({ error: options?.removeError ?? null });
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({ error: null });
  const nonceInsertMock = vi.fn().mockResolvedValue({ error: options?.nonceInsertError ?? null });
  const notificationsEqMock = vi.fn().mockResolvedValue({
    error: options?.deleteNotificationsError ?? null,
  });
  const deleteUserMock = vi.fn().mockResolvedValue({ error: options?.deleteUserError ?? null });

  const handler = createDeleteUserHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      supabasePublishableKey: options?.config?.supabasePublishableKey ?? 'anon-key',
      supabaseServiceRoleKey: options?.config?.supabaseServiceRoleKey ?? 'service-role',
      supabaseUrl: options?.config?.supabaseUrl ?? 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
      from: (table: string) => {
        if (table === 'request_nonces') {
          return {
            delete: () => ({
              lt: nonceDeleteLtMock,
            }),
            insert: nonceInsertMock,
          };
        }

        return {
          delete: () => ({
            eq: notificationsEqMock,
          }),
        };
      },
      storage: {
        from: () => ({
          list: listMock,
          remove: removeMock,
        }),
      },
    }),
    createAuthClient: () => ({
      auth: {
        getClaims: getClaimsMock,
      },
    }),
  });

  return {
    deleteUserMock,
    getClaimsMock,
    handler,
    listMock,
    nonceInsertMock,
    notificationsEqMock,
    removeMock,
  };
}

async function createSignedHeaders(body: string) {
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

  return {
    Authorization: 'Bearer token-1',
    'x-device-id': deviceId,
    'x-nonce': nonce,
    'x-signature': signature,
    'x-timestamp': timestamp,
  };
}

describe('delete-user handler', () => {
  it('handles preflight, method validation, configuration errors, and missing auth', async () => {
    const { handler } = createDeps();

    const optionsResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
        },
      }),
    );
    expect(optionsResponse.status).toBe(200);

    const methodResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'GET',
      }),
    );
    expect(methodResponse.status).toBe(405);

    const { handler: misconfiguredHandler } = createDeps({
      config: {
        supabaseServiceRoleKey: '',
      },
    });
    const misconfiguredResponse = await misconfiguredHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
      }),
    );
    expect(misconfiguredResponse.status).toBe(500);

    const missingAuthResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(missingAuthResponse.status).toBe(401);
  });

  it('rejects invalid claims, invalid signatures, and replayed requests', async () => {
    const { handler: invalidClaimsHandler } = createDeps({
      claimsResult: {
        data: null,
        error: { message: 'Invalid token' },
      },
    });

    const invalidClaimsResponse = await invalidClaimsHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );
    expect(invalidClaimsResponse.status).toBe(401);

    const { handler } = createDeps();
    const invalidSignatureResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{"tampered":true}',
      }),
    );
    expect(invalidSignatureResponse.status).toBe(401);

    const { handler: replayHandler } = createDeps({
      nonceInsertError: { code: '23505', message: 'duplicate' },
    });
    const replayResponse = await replayHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );
    expect(replayResponse.status).toBe(409);
  });

  it('deletes user storage, notifications, and account on success', async () => {
    const { deleteUserMock, handler, listMock, nonceInsertMock, notificationsEqMock } = createDeps();
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalled();
    expect(nonceInsertMock).toHaveBeenCalled();
    expect(notificationsEqMock).toHaveBeenCalledWith('actor_user_id', 'user-1');
    expect(deleteUserMock).toHaveBeenCalledWith('user-1', false);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it('propagates downstream failures', async () => {
    const { handler: listFailureHandler } = createDeps({
      listError: { message: 'list failed' },
    });
    const listFailureResponse = await listFailureHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );
    expect(listFailureResponse.status).toBe(500);

    const { handler: deleteNotificationsFailureHandler } = createDeps({
      deleteNotificationsError: { message: 'notifications failed' },
    });
    const deleteNotificationsFailureResponse = await deleteNotificationsFailureHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );
    expect(deleteNotificationsFailureResponse.status).toBe(500);

    const { handler: deleteUserFailureHandler } = createDeps({
      deleteUserError: { message: 'delete user failed' },
    });
    const deleteUserFailureResponse = await deleteUserFailureHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );
    expect(deleteUserFailureResponse.status).toBe(500);
  });
});
