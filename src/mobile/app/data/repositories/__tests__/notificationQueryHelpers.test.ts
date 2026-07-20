import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const rpcMock = vi.fn();
const abortSignalMock = vi.fn();

type QueryResult = { data: unknown; error: unknown };

let blockResult: QueryResult;
let notificationResult: QueryResult;
let profileResult: QueryResult;
let rpcResult: QueryResult;

function thenable(result: () => QueryResult, extras: Record<string, unknown> = {}) {
  return {
    ...extras,
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject),
  };
}

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

function notificationRow(overrides: Record<string, unknown> = {}) {
  return {
    actor_user_id: 'actor-1',
    created_at: '2026-07-01T12:00:00.000Z',
    follow_request: null,
    id: 'notification-1',
    list_id: null,
    list_place_id: null,
    message: 'message',
    read: false,
    recipient_user_id: 'viewer',
    type: 'follow',
    ...overrides,
  };
}

describe('notificationQueryHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blockResult = { data: [], error: null };
    notificationResult = { data: [], error: null };
    profileResult = { data: [], error: null };
    rpcResult = { data: [], error: null };

    fromMock.mockImplementation((table: string) => {
      if (table === 'user_blocks') {
        return {
          select: () => ({ or: () => Promise.resolve(blockResult) }),
        };
      }

      if (table === 'public_profile_summaries') {
        return {
          select: () => ({ in: () => Promise.resolve(profileResult) }),
        };
      }

      const range = vi.fn(() => Promise.resolve(notificationResult));
      const ordered = thenable(() => notificationResult, { range });
      return {
        select: () => ({
          eq: () => ({
            order: () => ordered,
          }),
        }),
      };
    });

    const request = thenable(() => rpcResult) as ReturnType<typeof thenable> & {
      abortSignal?: (signal: AbortSignal) => unknown;
    };
    request.abortSignal = abortSignalMock.mockImplementation(() => request);
    rpcMock.mockReturnValue(request);
  });

  it('maps notifications, follow requests, links and profile fallbacks', async () => {
    notificationResult.data = [
      notificationRow({
        follow_request: [{ id: 'request-1', status: 'pending' }],
        list_id: 'list-1',
        list_place_id: 'place-1',
      }),
      notificationRow({
        actor_user_id: 'actor-2',
        follow_request: { id: 'request-2', status: 'accepted' },
        id: 'notification-2',
      }),
      notificationRow({ actor_user_id: null, id: 'notification-3' }),
    ];
    profileResult.data = [
      { id: 'actor-1', name: 'Actor One', profile_photo_url: 'photo-1' },
      { id: 'actor-2', name: '', profile_photo_url: null },
    ];
    const { fetchNotifications } = await import(
      '@/mobile/app/data/repositories/notifications/notificationQueryHelpers'
    );

    const result = await fetchNotifications('viewer');

    expect(result).toEqual([
      expect.objectContaining({
        followRequest: { id: 'request-1', status: 'pending' },
        linkTo: { listId: 'list-1', placeId: 'place-1', type: 'list' },
        userId: 'actor-1',
        userName: 'Actor One',
        userPhoto: 'photo-1',
      }),
      expect.objectContaining({
        followRequest: { id: 'request-2', status: 'accepted' },
        linkTo: { type: 'profile', userId: 'actor-2' },
        userName: 'SoRita',
      }),
      expect.objectContaining({ linkTo: undefined, userId: '', userName: 'SoRita' }),
    ]);
  });

  it('filters both blocking directions and self-authored rows', async () => {
    blockResult.data = [
      { blocked_user_id: 'hidden-1', blocker_user_id: 'viewer' },
      { blocked_user_id: 'viewer', blocker_user_id: 'hidden-2' },
    ];
    notificationResult.data = [
      notificationRow({ actor_user_id: 'hidden-1', id: 'n1' }),
      notificationRow({ actor_user_id: 'hidden-2', id: 'n2' }),
      notificationRow({ actor_user_id: 'viewer', id: 'n3' }),
      notificationRow({ actor_user_id: 'visible', id: 'n4' }),
    ];
    profileResult.data = [
      { id: 'hidden-1', name: 'Hidden 1' },
      { id: 'hidden-2', name: 'Hidden 2' },
      { id: 'viewer', name: 'Self' },
      { id: 'visible', name: 'Visible' },
    ];
    const { fetchNotificationsPage } = await import(
      '@/mobile/app/data/repositories/notifications/notificationQueryHelpers'
    );

    await expect(fetchNotificationsPage('viewer', 10, 5)).resolves.toEqual([
      expect.objectContaining({ id: 'n4' }),
    ]);
  });

  it('does not request profiles when rows do not contain actors', async () => {
    notificationResult.data = [notificationRow({ actor_user_id: null })];
    const { fetchNotifications } = await import(
      '@/mobile/app/data/repositories/notifications/notificationQueryHelpers'
    );

    await expect(fetchNotifications('viewer')).resolves.toHaveLength(1);
    expect(fromMock).not.toHaveBeenCalledWith('public_profile_summaries');
  });

  it('propagates block, notification and profile query failures', async () => {
    const { fetchNotifications } = await import(
      '@/mobile/app/data/repositories/notifications/notificationQueryHelpers'
    );

    blockResult.error = new Error('blocks failed');
    await expect(fetchNotifications('viewer')).rejects.toThrow('blocks failed');

    blockResult.error = null;
    notificationResult.error = new Error('notifications failed');
    await expect(fetchNotifications('viewer')).rejects.toThrow('notifications failed');

    notificationResult = { data: [notificationRow()], error: null };
    profileResult.error = new Error('profiles failed');
    await expect(fetchNotifications('viewer')).rejects.toThrow('profiles failed');
  });

  it('maps one keyset RPC page and forwards cancellation', async () => {
    const controller = new AbortController();
    rpcResult.data = [
      {
        actor_name: 'Actor',
        actor_profile_photo_url: 'photo',
        actor_user_id: 'actor-1',
        created_at: '2026-07-02T12:00:00.000Z',
        follow_request_id: 'request-1',
        follow_request_status: null,
        id: 'n1',
        list_id: 'list-1',
        list_place_id: null,
        message: 'message',
        read: false,
        recipient_user_id: 'viewer',
        type: 'follow_request',
      },
      {
        actor_name: null,
        actor_profile_photo_url: null,
        actor_user_id: null,
        created_at: '2026-07-01T12:00:00.000Z',
        follow_request_id: null,
        id: 'n2',
        list_id: null,
        list_place_id: null,
        message: 'system',
        read: true,
        recipient_user_id: 'viewer',
        type: 'system_announcement',
      },
    ];
    const { fetchNotificationsCursorPage } = await import(
      '@/mobile/app/data/repositories/notifications/notificationQueryHelpers'
    );

    const page = await fetchNotificationsCursorPage({
      cursor: { createdAt: '2026-07-03T12:00:00.000Z', id: 'cursor-id' },
      pageSize: 2,
      signal: controller.signal,
      userId: 'viewer',
    });

    expect(rpcMock).toHaveBeenCalledWith('notifications_page', {
      p_cursor_created_at: '2026-07-03T12:00:00.000Z',
      p_cursor_id: 'cursor-id',
      p_limit: 2,
    });
    expect(abortSignalMock).toHaveBeenCalledWith(controller.signal);
    expect(page).toHaveLength(2);
    expect(page[0]).toEqual(
      expect.objectContaining({
        followRequest: { id: 'request-1', status: 'pending' },
        linkTo: { listId: 'list-1', placeId: undefined, type: 'list' },
        userName: 'Actor',
        userPhoto: 'photo',
      }),
    );
    expect(page[1]).toEqual(
      expect.objectContaining({ linkTo: undefined, userId: '', userName: 'SoRita', userPhoto: undefined }),
    );
    expect(page.nextCursor).toEqual({ createdAt: '2026-07-01T12:00:00.000Z', id: 'n2' });
  });

  it('filters self rows and omits the cursor on a short keyset page', async () => {
    rpcResult.data = [
      {
        actor_user_id: 'viewer',
        created_at: '2026-07-01T12:00:00.000Z',
        id: 'self',
        message: 'self',
        read: false,
        recipient_user_id: 'viewer',
        type: 'follow',
      },
    ];
    const { fetchNotificationsCursorPage } = await import(
      '@/mobile/app/data/repositories/notifications/notificationQueryHelpers'
    );

    const page = await fetchNotificationsCursorPage({ pageSize: 20, userId: 'viewer' });
    expect(page).toHaveLength(0);
    expect(page.nextCursor).toBeUndefined();
  });

  it('propagates keyset RPC errors and tolerates null response data', async () => {
    const { fetchNotificationsCursorPage } = await import(
      '@/mobile/app/data/repositories/notifications/notificationQueryHelpers'
    );

    rpcResult.error = new Error('rpc failed');
    await expect(fetchNotificationsCursorPage({ pageSize: 20, userId: 'viewer' })).rejects.toThrow('rpc failed');

    rpcResult = { data: null, error: null };
    await expect(fetchNotificationsCursorPage({ pageSize: 20, userId: 'viewer' })).resolves.toEqual([]);
  });
});
