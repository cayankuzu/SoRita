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
  ledgerErrorStep?: string;
  listError?: { message: string } | null;
  listResponses?: Record<string, { data?: Array<{ id?: string | null; name?: string | null }> | null; error?: { message: string } | null }>;
  nonceInsertError?: { code?: string; message: string } | null;
  paginatedRootItems?: Array<{ id?: string | null; name?: string | null }>;
  removeError?: { message: string } | null;
  rateLimitResult?: { allowed: boolean; remaining: number; retry_after_seconds: number };
}) {
  const getClaimsMock = vi.fn().mockResolvedValue(options?.claimsResult ?? {
    data: {
      claims: {
        sub: 'user-1',
      },
    },
    error: null,
  });
  const listMock = vi.fn().mockImplementation(async (
    path: string,
    listOptions?: { limit: number; offset: number },
  ) => {
    if (path === 'user-1' && options?.paginatedRootItems && listOptions) {
      return {
        data: options.paginatedRootItems.slice(
          listOptions.offset,
          listOptions.offset + listOptions.limit,
        ),
        error: null,
      };
    }
    const response = options?.listResponses?.[path];
    return {
      data: response ? response.data ?? null : [],
      error: response?.error ?? options?.listError ?? null,
    };
  });
  const removeMock = vi.fn().mockResolvedValue({ error: options?.removeError ?? null });
  const storageFromMock = vi.fn(() => ({
    list: listMock,
    remove: removeMock,
  }));
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({ error: null });
  const nonceInsertMock = vi.fn().mockResolvedValue({ error: options?.nonceInsertError ?? null });
  const notificationsEqMock = vi.fn().mockResolvedValue({
    error: options?.deleteNotificationsError ?? null,
  });
  const deleteUserMock = vi.fn().mockResolvedValue({ error: options?.deleteUserError ?? null });
  const rpcMock = vi.fn().mockImplementation((functionName: string, args?: Record<string, unknown>) => {
    if (functionName === 'enforce_edge_rate_limit') {
      return Promise.resolve({
        data: options?.rateLimitResult ?? { allowed: true, remaining: 1, retry_after_seconds: 0 },
        error: null,
      });
    }

    if (functionName === 'record_account_deletion_step') {
      const step = args?.p_step;
      return Promise.resolve({
        data: null,
        error: step === options?.ledgerErrorStep ? { message: 'ledger failed' } : null,
      });
    }

    return Promise.resolve({ data: null, error: { message: `Unexpected RPC: ${functionName}` } });
  });

  const handler = createDeleteUserHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      supabasePublishableKey: options?.config?.supabasePublishableKey ?? 'anon-key',
      supabaseServiceRoleKey: options?.config?.supabaseServiceRoleKey ?? 'service-role',
      supabaseUrl: options?.config?.supabaseUrl ?? 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      rpc: rpcMock,
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
        from: storageFromMock,
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
    rpcMock,
    storageFromMock,
  };
}

let signedHeaderCounter = 0;

async function createSignedHeaders(body: string) {
  signedHeaderCounter += 1;
  const deviceId = `device-1234-${signedHeaderCounter}`;
  const nonce = `nonce-1234-5678-90ab-${signedHeaderCounter}`;
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

    for (const config of [{ supabaseUrl: '' }, { supabasePublishableKey: '' }]) {
      const response = await createDeps({ config }).handler(
        new Request('https://example.supabase.co/functions/v1/delete-user', {
          method: 'POST',
        }),
      );
      expect(response.status).toBe(500);
    }

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

    const { handler: missingSubjectHandler } = createDeps({
      claimsResult: { data: { claims: {} }, error: null },
    });
    const missingSubjectResponse = await missingSubjectHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders('{}'), body: '{}',
      }),
    );
    expect(missingSubjectResponse.status).toBe(401);
    await expect(missingSubjectResponse.json()).resolves.toMatchObject({ error: 'Invalid JWT' });

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

  it('rejects malformed payloads and applies the persistent deletion rate limit', async () => {
    const { handler } = createDeps();
    const malformedBody = '{invalid';
    const malformedResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders(malformedBody), body: malformedBody,
      }),
    );
    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toMatchObject({ code: 'invalid_json' });

    const nullBody = 'null';
    const invalidInputResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders(nullBody), body: nullBody,
      }),
    );
    expect(invalidInputResponse.status).toBe(400);
    await expect(invalidInputResponse.json()).resolves.toMatchObject({ code: 'invalid_input' });

    const { handler: limitedHandler } = createDeps({
      rateLimitResult: { allowed: false, remaining: 0, retry_after_seconds: 30 },
    });
    const limitedResponse = await limitedHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders('{}'), body: '{}',
      }),
    );
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('Retry-After')).toBe('30');
  });

  it('deletes user storage, notifications, and account on success', async () => {
    const { deleteUserMock, handler, listMock, nonceInsertMock, notificationsEqMock, rpcMock, storageFromMock } = createDeps();
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalled();
    expect(storageFromMock).toHaveBeenCalledWith('profile-media');
    expect(storageFromMock).toHaveBeenCalledWith('place-media');
    expect(storageFromMock).toHaveBeenCalledWith('place-media-private');
    expect(nonceInsertMock).toHaveBeenCalled();
    expect(notificationsEqMock).toHaveBeenCalledWith('actor_user_id', 'user-1');
    expect(deleteUserMock).toHaveBeenCalledWith('user-1', false);
    expect(rpcMock.mock.calls.filter(([name]) => name === 'record_account_deletion_step').map(([, args]) => args.p_step)).toEqual([
      'requested',
      'storage_deleted',
      'notifications_deleted',
      'auth_delete_started',
      'completed',
    ]);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it('recursively deletes nested user storage folders before removing the account', async () => {
    const { handler, listMock, removeMock } = createDeps({
      listResponses: {
        'user-1': {
          data: [
            { id: 'file-root', name: 'cover.jpg' },
            { id: null, name: 'nested-folder' },
          ],
        },
        'user-1/nested-folder': {
          data: [
            { id: 'file-nested', name: 'nested.jpg' },
          ],
        },
      },
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: await createSignedHeaders('{}'),
        body: '{}',
      }),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith('user-1', { limit: 1000, offset: 0 });
    expect(listMock).toHaveBeenCalledWith('user-1/nested-folder', { limit: 1000, offset: 0 });
    expect(removeMock).toHaveBeenCalledWith([
      'user-1/cover.jpg',
      'user-1/nested-folder/nested.jpg',
    ]);
  });

  it('paginates and chunks large storage folders while ignoring nameless rows', async () => {
    const paginatedRootItems = Array.from({ length: 1001 }, (_, index) => ({
      id: `file-${index}`,
      name: `file-${index}.jpg`,
    }));
    paginatedRootItems.splice(500, 0, { id: null, name: null });
    const { handler, listMock, removeMock } = createDeps({ paginatedRootItems });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders('{}'), body: '{}',
      }),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith('user-1', { limit: 1000, offset: 1000 });
    expect(removeMock).toHaveBeenCalledWith(['user-1/file-1000.jpg']);
  });

  it('treats null storage listings as empty folders', async () => {
    const { handler, removeMock } = createDeps({
      listResponses: { 'user-1': { data: null } },
    });
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders('{}'), body: '{}',
      }),
    );
    expect(response.status).toBe(200);
    expect(removeMock).not.toHaveBeenCalled();
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

    const { handler: removeFailureHandler } = createDeps({
      listResponses: { 'user-1': { data: [{ id: 'file-1', name: 'cover.jpg' }] } },
      removeError: { message: 'remove failed' },
    });
    const removeFailureResponse = await removeFailureHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders('{}'), body: '{}',
      }),
    );
    expect(removeFailureResponse.status).toBe(500);

    const { handler: ledgerFailureHandler } = createDeps({ ledgerErrorStep: 'requested' });
    const ledgerFailureResponse = await ledgerFailureHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders('{}'), body: '{}',
      }),
    );
    expect(ledgerFailureResponse.status).toBe(500);

    const { handler: failedLedgerFailureHandler } = createDeps({
      ledgerErrorStep: 'failed',
      listError: { message: 'list failed before failed-ledger write' },
    });
    const failedLedgerFailureResponse = await failedLedgerFailureHandler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        method: 'POST', headers: await createSignedHeaders('{}'), body: '{}',
      }),
    );
    expect(failedLedgerFailureResponse.status).toBe(500);
  });
});
