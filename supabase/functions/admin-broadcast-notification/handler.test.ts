import { describe, expect, it, vi } from 'vitest';

import { createAdminBroadcastNotificationHandler } from './handler';

const IDEMPOTENCY_KEY = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function createDeps(options?: {
  fetchRecipientUserIds?: string[];
  invalidToken?: boolean;
}) {
  const fetchRecipientUserIds = vi.fn().mockResolvedValue(
    options?.fetchRecipientUserIds ?? ['user-1', 'user-2'],
  );
  const insertNotifications = vi.fn().mockResolvedValue(2);
  const enforceAdminRateLimit = vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 4,
  });

  const handler = createAdminBroadcastNotificationHandler({
    config: {
      adminToken: 'secret-token',
      allowedOrigins: ['http://localhost:5173'],
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
    },
    enforceAdminRateLimit,
    repository: {
      fetchRecipientUserIds,
      insertNotifications,
    },
  });

  return {
    fetchRecipientUserIds,
    enforceAdminRateLimit,
    handler,
    insertNotifications,
    token: options?.invalidToken ? 'wrong-token' : 'secret-token',
  };
}

describe('admin-broadcast-notification handler', () => {
  it('rejects missing or invalid authorization', async () => {
    const { handler } = createDeps();

    const missingAuthResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/admin-broadcast-notification', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Body',
          title: 'Title',
        }),
      }),
    );

    expect(missingAuthResponse.status).toBe(401);

    const invalidAuthResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/admin-broadcast-notification', {
        method: 'POST',
        headers: {
          'x-admin-token': 'wrong-token',
        },
        body: JSON.stringify({
          message: 'Body',
          title: 'Title',
        }),
      }),
    );

    expect(invalidAuthResponse.status).toBe(401);
  });

  it('returns recipient counts in dry-run mode without inserting notifications', async () => {
    const { fetchRecipientUserIds, handler, insertNotifications, token } = createDeps({
      fetchRecipientUserIds: ['user-1', 'user-2', 'user-3'],
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/admin-broadcast-notification', {
        method: 'POST',
        headers: {
          'x-admin-token': token,
        },
        body: JSON.stringify({
          dryRun: true,
          message: 'Yeni guncelleme geldi.',
          title: 'SoRita',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      dryRun: true,
      insertedCount: 0,
      recipientCount: 3,
      success: true,
    });
    expect(fetchRecipientUserIds).toHaveBeenCalledWith(undefined);
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it('inserts notifications for resolved recipients', async () => {
    const { fetchRecipientUserIds, handler, insertNotifications, token } = createDeps();

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/admin-broadcast-notification', {
        method: 'POST',
        headers: {
          'x-admin-token': token,
        },
        body: JSON.stringify({
          idempotencyKey: IDEMPOTENCY_KEY,
          message: 'Yeni guncelleme geldi.',
          title: 'SoRita duyuru',
          userIds: ['550e8400-e29b-41d4-a716-446655440000'],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      dryRun: false,
      duplicateCount: 0,
      insertedCount: 2,
      recipientCount: 2,
      success: true,
    });
    expect(fetchRecipientUserIds).toHaveBeenCalledWith(['550e8400-e29b-41d4-a716-446655440000']);
    expect(insertNotifications).toHaveBeenCalledWith({
      idempotencyKey: IDEMPOTENCY_KEY,
      message: 'Yeni guncelleme geldi.',
      pushTitle: 'SoRita duyuru',
      recipientUserIds: ['user-1', 'user-2'],
    });
  });

  it('reports recipients already claimed by the same idempotency key', async () => {
    const { handler, insertNotifications, token } = createDeps();
    insertNotifications.mockResolvedValueOnce(0);

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/admin-broadcast-notification', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: JSON.stringify({
          idempotencyKey: IDEMPOTENCY_KEY,
          message: 'Yeni guncelleme geldi.',
          title: 'SoRita duyuru',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      duplicateCount: 2,
      insertedCount: 0,
      recipientCount: 2,
      success: true,
    });
  });

  it('rate limits authenticated broadcast attempts before reading recipients', async () => {
    const {
      enforceAdminRateLimit,
      fetchRecipientUserIds,
      handler,
      token,
    } = createDeps();
    enforceAdminRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 12_500,
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/admin-broadcast-notification', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: JSON.stringify({ message: 'Body', title: 'Title' }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('13');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(fetchRecipientUserIds).not.toHaveBeenCalled();
  });

  it('handles CORS, methods, configuration, invalid payloads, empty recipients, and failures', async () => {
    const endpoint = 'https://example.supabase.co/functions/v1/admin-broadcast-notification';
    const repository = {
      fetchRecipientUserIds: vi.fn().mockResolvedValue([]),
      insertNotifications: vi.fn(),
    };
    const createHandler = (configOverrides: Partial<{
      adminToken: string;
      allowedOrigins: string[];
      supabaseServiceRoleKey: string;
      supabaseUrl: string;
    }> = {}) => createAdminBroadcastNotificationHandler({
      config: {
        adminToken: 'secret-token', allowedOrigins: [], supabaseServiceRoleKey: 'service-role',
        supabaseUrl: 'https://example.supabase.co', ...configOverrides,
      },
      createRequestId: () => 'request-id',
      enforceAdminRateLimit: async () => ({ allowed: true, remaining: 4 }),
      repository,
    });

    const handler = createHandler();
    const preflight = await handler(new Request(endpoint, {
      method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:3000' },
    }));
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('null');

    const methodResponse = await handler(new Request(endpoint, { method: 'GET' }));
    expect(methodResponse.status).toBe(405);

    for (const configOverrides of [
      { adminToken: ' ' },
      { supabaseServiceRoleKey: ' ' },
      { supabaseUrl: ' ' },
    ]) {
      const response = await createHandler(configOverrides)(new Request(endpoint, {
        method: 'POST', headers: { 'x-admin-token': 'secret-token' },
        body: JSON.stringify({ message: 'Body', title: 'Title' }),
      }));
      expect(response.status).toBe(500);
    }

    const invalidJsonResponse = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'x-admin-token': 'secret-token' }, body: '{broken',
    }));
    expect(invalidJsonResponse.status).toBe(400);
    const invalidInputResponse = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'x-admin-token': 'secret-token' },
      body: JSON.stringify({ message: '', title: '' }),
    }));
    expect(invalidInputResponse.status).toBe(400);
    const missingIdempotencyKeyResponse = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'x-admin-token': 'secret-token' },
      body: JSON.stringify({ message: 'Body', title: 'Title' }),
    }));
    expect(missingIdempotencyKeyResponse.status).toBe(400);
    await expect(missingIdempotencyKeyResponse.json()).resolves.toMatchObject({
      code: 'idempotency_key_required',
    });

    const emptyResponse = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'x-admin-token': 'secret-token' },
      body: JSON.stringify({
        idempotencyKey: IDEMPOTENCY_KEY,
        message: '  Body  ', title: '  Title  ',
        userIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440000',
        ],
      }),
    }));
    await expect(emptyResponse.json()).resolves.toMatchObject({
      dryRun: false, insertedCount: 0, recipientCount: 0, success: true,
    });
    expect(repository.fetchRecipientUserIds).toHaveBeenLastCalledWith([
      '550e8400-e29b-41d4-a716-446655440000',
    ]);

    repository.fetchRecipientUserIds.mockRejectedValueOnce(new Error('repository failed'));
    const errorResponse = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'x-admin-token': 'secret-token' },
      body: JSON.stringify({ idempotencyKey: IDEMPOTENCY_KEY, message: 'Body', title: 'Title' }),
    }));
    expect(errorResponse.status).toBe(500);
    await expect(errorResponse.json()).resolves.toMatchObject({ error: 'Internal server error' });

    repository.fetchRecipientUserIds.mockRejectedValueOnce('failure');
    const unknownErrorResponse = await handler(new Request(endpoint, {
      method: 'POST', headers: { 'x-admin-token': 'secret-token' },
      body: JSON.stringify({ idempotencyKey: IDEMPOTENCY_KEY, message: 'Body', title: 'Title' }),
    }));
    await expect(unknownErrorResponse.json()).resolves.toMatchObject({
      error: 'Internal server error',
    });
  });
});
