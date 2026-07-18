import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
  },
}));

function createThenableChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};

  Object.assign(chain, {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => chain),
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
    limit: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    then: Promise<{ data?: unknown; error?: unknown }>['then'];
  };
}

function expectQuery(query: ReturnType<typeof createThenableChain> | null) {
  if (!query) {
    throw new Error('Expected query chain to be captured');
  }

  return query;
}

describe('visibleDataRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'viewer',
            email: 'viewer@example.com',
          },
        },
      },
      error: null,
    });
  });

  it('builds visible context and list pages and exposes focused lookup helpers', async () => {
    const rowsByTable = {
      public_profile_summaries: [
        {
          id: 'viewer',
          name: 'Viewer',
          username: 'viewer',
          is_public_account: true,
          bio: 'bio',
          profile_photo_url: 'https://cdn.example.com/profile.jpg',
          cover_photo_url: null,
          interests: ['coffee'],
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'target',
          name: 'Target',
          username: 'target',
          is_public_account: false,
          bio: null,
          profile_photo_url: null,
          cover_photo_url: null,
          interests: null,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      user_follows: [
        {
          follower_id: 'viewer',
          following_id: 'target',
          created_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      follow_requests: [],
      user_blocks: [],
      lists: [
        {
          id: 'list-1',
          owner_id: 'target',
          name: 'Target list',
          description: 'best places',
          emoji: '⭐',
          cover_image_url: ' https://cdn.example.com/cover.jpg ',
          is_public: true,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-02T00:00:00.000Z',
          list_likes: [
            {
              list_id: 'list-1',
              user_id: 'viewer',
              created_at: '2025-01-03T00:00:00.000Z',
            },
          ],
          list_places: [
            {
              id: 'place-1',
              list_id: 'list-1',
              created_by: 'target',
              name: 'Cafe',
              title: 'Brunch',
              menu_url: 'https://menu.example.com/cafe',
              lat: 39.93,
              lng: 32.85,
              address: 'Ankara',
              notes: null,
              rating: 4,
              category: 'coffee',
              categories: ['coffee'],
              student_discount: true,
              price_range: 2,
              price_min: 100,
              price_max: 200,
              best_time: 'morning',
              best_times: ['morning'],
              atmosphere: ['cozy'],
              special_features: ['WiFi'],
              added_at: '2025-01-01T00:00:00.000Z',
              updated_at: '2025-01-02T00:00:00.000Z',
              list_place_likes: [
                {
                  list_place_id: 'place-1',
                  user_id: 'viewer',
                  created_at: '2025-01-03T00:00:00.000Z',
                },
              ],
              list_place_comments: [
                {
                  id: 'comment-1',
                  list_place_id: 'place-1',
                  user_id: 'viewer',
                  parent_comment_id: null,
                  content: 'great',
                  created_at: '2025-01-03T00:00:00.000Z',
                  updated_at: '2025-01-03T00:00:00.000Z',
                  list_place_comment_likes: [],
                },
              ],
              list_place_photos: [
                {
                  id: 'photo-1',
                  list_place_id: 'place-1',
                  url: 'https://cdn.example.com/photo.jpg',
                  sort_order: 0,
                  created_at: '2025-01-01T00:00:00.000Z',
                },
              ],
            },
          ],
        },
      ],
    } as const;

    fromMock.mockImplementation((table: keyof typeof rowsByTable) =>
      createThenableChain({
        data: rowsByTable[table],
        error: null,
      }),
    );

    const repository = await import('@/mobile/app/data/repositories/visibleDataRepository');

    const context = await repository.fetchVisibleDataContext('viewer');
    const lists = await repository.fetchVisibleListsPage({
      allUsers: context.allUsers,
      blockRows: context.blockRows,
      limit: 20,
      viewerId: 'viewer',
    });
    const visibleUser = await repository.fetchVisibleUserById('target');
    const fullUser = await repository.fetchUserByIdIncludingBlocked('target');
    const blockState = await repository.fetchBlockState('viewer', 'target');

    expect(context.currentUser?.id).toBe('viewer');
    expect(context.users.map((item) => item.id)).toEqual(['viewer', 'target']);
    expect(lists[0]).toMatchObject({
      id: 'list-1',
      userId: 'target',
      likes: 1,
      likedBy: ['viewer'],
      coverImage: 'https://cdn.example.com/cover.jpg',
    });
    expect(lists[0]?.places[0]).toMatchObject({
      id: 'place-1',
      menuUrl: 'https://menu.example.com/cafe',
      likes: 1,
      likedBy: ['viewer'],
      photos: ['https://cdn.example.com/photo.jpg'],
    });
    expect(visibleUser?.id).toBe('target');
    expect(fullUser?.id).toBe('target');
    expect(blockState).toEqual({
      blockedByCurrent: false,
      blockedByTarget: false,
    });
  });

  it('supports public snapshots without a viewer id', async () => {
    let listsQuery: ReturnType<typeof createThenableChain> | null = null;

    fromMock.mockImplementation((table: string) => {
      const result = createThenableChain({
        data: table === 'public_profile_summaries'
          ? [{
              id: 'public-user',
              name: 'Public',
              username: 'public',
              is_public_account: true,
              bio: null,
              profile_photo_url: null,
              cover_photo_url: null,
              interests: null,
              created_at: '2025-01-01T00:00:00.000Z',
              updated_at: '2025-01-01T00:00:00.000Z',
            }]
          : table === 'lists'
            ? [{
                id: 'list-1',
                owner_id: 'public-user',
                name: 'Public list',
                description: null,
                emoji: null,
                cover_image_url: null,
                is_public: true,
                created_at: '2025-01-01T00:00:00.000Z',
                updated_at: '2025-01-01T00:00:00.000Z',
                list_likes: [],
                list_places: [],
              }]
            : [],
        error: null,
      });

      if (table === 'lists') {
        listsQuery = result;
      }

      return result;
    });

    const repository = await import('@/mobile/app/data/repositories/visibleDataRepository');
    const context = await repository.fetchVisibleDataContext();
    const lists = await repository.fetchVisibleListsPage({
      allUsers: context.allUsers,
      blockRows: context.blockRows,
      limit: 20,
    });

    expect(context.currentUser).toBeNull();
    expect(context.users.map((item) => item.id)).toEqual(['public-user']);
    expect(lists).toHaveLength(1);
    expect(expectQuery(listsQuery).eq).toHaveBeenCalledWith('is_public', true);
  });

  it('builds a context-only view and paginated list queries with filters', async () => {
    let ownerListsQuery: ReturnType<typeof createThenableChain> | null = null;
    let publicListsQuery: ReturnType<typeof createThenableChain> | null = null;
    let listByIdQuery: ReturnType<typeof createThenableChain> | null = null;

    fromMock.mockImplementation((table: string) => {
      const result = createThenableChain({
        data: table === 'public_profile_summaries'
          ? [{
              id: 'viewer',
              name: 'Viewer',
              username: 'viewer',
              is_public_account: true,
              bio: null,
              profile_photo_url: null,
              cover_photo_url: null,
              interests: null,
              created_at: '2025-01-01T00:00:00.000Z',
              updated_at: '2025-01-01T00:00:00.000Z',
            }]
          : table === 'lists'
            ? [{
                id: 'list-1',
                owner_id: 'viewer',
                name: 'Visible list',
                description: null,
                emoji: null,
                cover_image_url: null,
                is_public: true,
                created_at: '2025-01-01T00:00:00.000Z',
                updated_at: '2025-01-01T00:00:00.000Z',
                list_likes: [],
                list_places: [],
              }]
            : [],
        error: null,
      });

      if (table === 'lists' && !ownerListsQuery) {
        ownerListsQuery = result;
      } else if (table === 'lists' && !publicListsQuery) {
        publicListsQuery = result;
      } else if (table === 'lists') {
        listByIdQuery = result;
      }

      return result;
    });

    const repository = await import('@/mobile/app/data/repositories/visibleDataRepository');
    const context = await repository.fetchVisibleDataContext('viewer');
    const ownLists = await repository.fetchVisibleListsPage({
      allUsers: context.allUsers,
      blockRows: context.blockRows,
      limit: 10,
      ownerId: 'viewer',
      viewerId: 'viewer',
    });
    const publicLists = await repository.fetchVisibleListsPage({
      allUsers: context.allUsers,
      blockRows: context.blockRows,
      limit: 10,
      publicOnly: true,
    });
    const listById = await repository.fetchVisibleListsPage({
      allUsers: context.allUsers,
      blockRows: context.blockRows,
      limit: 1,
      listId: 'list-1',
      viewerId: 'viewer',
    });

    expect(context.currentUser?.id).toBe('viewer');
    expect(expectQuery(ownerListsQuery).eq).toHaveBeenCalledWith('owner_id', 'viewer');
    expect(expectQuery(publicListsQuery).eq).toHaveBeenCalledWith('is_public', true);
    expect(expectQuery(listByIdQuery).eq).toHaveBeenCalledWith('id', 'list-1');
    expect(ownLists).toHaveLength(1);
    expect(publicLists).toHaveLength(1);
    expect(listById).toHaveLength(1);
  });

  it('propagates upstream fetch failures', async () => {
    const repository = await import('@/mobile/app/data/repositories/visibleDataRepository');

    fromMock.mockImplementation((table: string) =>
      createThenableChain({
        data: [],
        error: table === 'public_profile_summaries' ? new Error('profiles failed') : null,
      }),
    );
    await expect(repository.fetchVisibleDataContext('viewer')).rejects.toThrow('profiles failed');

    fromMock.mockImplementation((table: string) =>
      createThenableChain({
        data: [],
        error: table === 'user_follows' ? new Error('follows failed') : null,
      }),
    );
    await expect(repository.fetchVisibleDataContext('viewer')).rejects.toThrow('follows failed');

    fromMock.mockImplementation((table: string) =>
      createThenableChain({
        data: [],
        error: table === 'follow_requests' ? new Error('requests failed') : null,
      }),
    );
    await expect(repository.fetchVisibleDataContext('viewer')).rejects.toThrow('requests failed');

    fromMock.mockImplementation((table: string) =>
      createThenableChain({
        data: [],
        error: table === 'user_blocks' ? new Error('blocks failed') : null,
      }),
    );
    await expect(repository.fetchVisibleDataContext('viewer')).rejects.toThrow('blocks failed');

    fromMock.mockImplementation((table: string) =>
      createThenableChain({
        data: [],
        error: table === 'lists' ? new Error('lists failed') : null,
      }),
    );
    const context = {
      allUsers: [],
      blockRows: [],
    };
    await expect(repository.fetchVisibleListsPage({
      ...context,
      limit: 20,
      viewerId: 'viewer',
    })).rejects.toThrow('lists failed');
  });
});
