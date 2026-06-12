import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

function createThenableChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};

  Object.assign(chain, {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    select: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return chain as {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    then: Promise<{ data?: unknown; error?: unknown }>['then'];
  };
}

describe('notificationQueryHelpers', () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00.000Z'));
  });

  it('maps and filters notifications for hidden users', async () => {
    const blocksChain = createThenableChain({
      data: [
        { blocker_user_id: 'viewer', blocked_user_id: 'hidden', created_at: '2025-01-01T00:00:00.000Z' },
      ],
      error: null,
    });
    const notificationsChain = createThenableChain({
      data: [
        {
          id: 'n1',
          recipient_user_id: 'viewer',
          actor_user_id: 'visible',
          type: 'follow',
          message: 'followed you',
          list_id: null,
          list_place_id: null,
          follow_request_id: null,
          read: false,
          created_at: '2025-01-08T11:30:00.000Z',
        },
        {
          id: 'n2',
          recipient_user_id: 'viewer',
          actor_user_id: 'hidden',
          type: 'like',
          message: 'liked your list',
          list_id: 'list-1',
          list_place_id: 'place-1',
          follow_request_id: null,
          read: true,
          created_at: '2025-01-08T11:00:00.000Z',
        },
      ],
      error: null,
    });
    const profilesChain = createThenableChain({
      data: [
        {
          id: 'visible',
          name: 'Visible',
          username: 'visible',
          is_public_account: true,
          bio: null,
          profile_photo_url: 'photo.jpg',
          cover_photo_url: null,
          interests: null,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'hidden',
          name: 'Hidden',
          username: 'hidden',
          is_public_account: true,
          bio: null,
          profile_photo_url: null,
          cover_photo_url: null,
          interests: null,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(blocksChain)
      .mockReturnValueOnce(notificationsChain)
      .mockReturnValueOnce(profilesChain);

    const helpers = await import('@/mobile/app/data/repositories/notifications/notificationQueryHelpers');
    const items = await helpers.fetchNotifications('viewer');

    expect(blocksChain.or).toHaveBeenCalledWith('blocker_user_id.eq.viewer,blocked_user_id.eq.viewer');
    expect(profilesChain.in).toHaveBeenCalledWith('id', ['visible', 'hidden']);

    expect(items).toEqual([
      expect.objectContaining({
        id: 'n1',
        userName: 'Visible',
        userPhoto: 'photo.jpg',
        userId: 'visible',
        timestamp: '30 dk once',
        linkTo: { type: 'profile', userId: 'visible' },
      }),
    ]);
  });

  it('supports ranged notification pagination', async () => {
    const blocksChain = createThenableChain({
      data: [],
      error: null,
    });
    const notificationsChain = createThenableChain({
      data: [
        {
          id: 'n1',
          recipient_user_id: 'viewer',
          actor_user_id: 'visible',
          type: 'follow_request',
          message: 'requested',
          list_id: 'list-1',
          list_place_id: null,
          follow_request_id: 'request-1',
          read: false,
          created_at: '2025-01-07T12:00:00.000Z',
          follow_request: { id: 'request-1', status: 'pending' },
        },
      ],
      error: null,
    });
    const profilesChain = createThenableChain({
      data: [
        {
          id: 'visible',
          name: 'Visible',
          username: 'visible',
          is_public_account: true,
          bio: null,
          profile_photo_url: null,
          cover_photo_url: null,
          interests: null,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(blocksChain)
      .mockReturnValueOnce(notificationsChain)
      .mockReturnValueOnce(profilesChain);

    const helpers = await import('@/mobile/app/data/repositories/notifications/notificationQueryHelpers');
    const items = await helpers.fetchNotificationsPage('viewer', 20, 10);

    expect(blocksChain.or).toHaveBeenCalledWith('blocker_user_id.eq.viewer,blocked_user_id.eq.viewer');
    expect(notificationsChain.range).toHaveBeenCalledWith(20, 29);
    expect(profilesChain.in).toHaveBeenCalledWith('id', ['visible']);
    expect(items[0]).toMatchObject({
      id: 'n1',
      followRequest: { id: 'request-1', status: 'pending' },
      linkTo: { type: 'list', listId: 'list-1', placeId: undefined },
      timestamp: '1 gun once',
    });
  });
});
