import { describe, expect, it, vi } from 'vitest';

import { createAdminBroadcastNotificationHandler } from './handler';

function createDeps(options?: {
  fetchRecipientUserIds?: string[];
  invalidToken?: boolean;
}) {
  const fetchRecipientUserIds = vi.fn().mockResolvedValue(
    options?.fetchRecipientUserIds ?? ['user-1', 'user-2'],
  );
  const insertNotifications = vi.fn().mockResolvedValue(2);

  const handler = createAdminBroadcastNotificationHandler({
    config: {
      adminToken: 'secret-token',
      allowedOrigins: ['http://localhost:5173'],
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
    },
    repository: {
      fetchRecipientUserIds,
      insertNotifications,
    },
  });

  return {
    fetchRecipientUserIds,
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
          message: 'Yeni guncelleme geldi.',
          title: 'SoRita duyuru',
          userIds: ['550e8400-e29b-41d4-a716-446655440000'],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      dryRun: false,
      insertedCount: 2,
      recipientCount: 2,
      success: true,
    });
    expect(fetchRecipientUserIds).toHaveBeenCalledWith(['550e8400-e29b-41d4-a716-446655440000']);
    expect(insertNotifications).toHaveBeenCalledWith({
      message: 'Yeni guncelleme geldi.',
      pushTitle: 'SoRita duyuru',
      recipientUserIds: ['user-1', 'user-2'],
    });
  });
});
