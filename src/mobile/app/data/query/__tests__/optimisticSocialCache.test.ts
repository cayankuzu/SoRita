import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  applyOptimisticBlock,
  applyOptimisticCommentCreate,
  applyOptimisticCommentDelete,
  applyOptimisticCommentLike,
  applyOptimisticCommentUpdate,
  applyOptimisticExploreFollow,
  applyOptimisticFollow,
  applyOptimisticListCreate,
  applyOptimisticListDelete,
  applyOptimisticListsUpdate,
  applyOptimisticListUpdate,
  applyOptimisticPlaceDelete,
  applyOptimisticPlaceLike,
  applyOptimisticUnblock,
  applyOptimisticUserProfile,
  inferOptimisticFollowResult,
  restoreQueries,
  snapshotQueries,
} from '@/mobile/app/data/query/optimisticSocialCache';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const createdAt = '2026-07-15T10:00:00.000Z';

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'viewer',
    email: 'viewer@example.com',
    name: 'Viewer',
    username: 'viewer',
    blockedByUsers: [],
    blockedUsers: [],
    followers: [],
    following: [],
    pendingFollowRequestsReceived: [],
    pendingFollowRequestsSent: [],
    ...overrides,
  };
}

function createPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place-1',
    name: 'Roastery',
    lat: 41,
    lng: 29,
    addedAt: createdAt,
    updatedAt: createdAt,
    comments: [
      {
        id: 'comment-1',
        userId: 'target',
        content: 'Original',
        createdAt,
        updatedAt: createdAt,
        replies: [
          {
            id: 'reply-1',
            userId: 'target',
            parentCommentId: 'comment-1',
            content: 'Reply',
            createdAt,
            updatedAt: createdAt,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createList(overrides: Partial<PlaceList> = {}): PlaceList {
  return {
    id: 'list-1',
    userId: 'target',
    name: 'Coffee',
    places: [createPlace()],
    isPublic: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function seedVisibleData(queryClient: QueryClient) {
  const viewer = createUser({
    id: 'viewer',
    following: ['target'],
    pendingFollowRequestsSent: ['pending'],
  });
  const target = createUser({
    id: 'target',
    email: 'target@example.com',
    name: 'Target',
    username: 'target',
    followers: ['viewer'],
    isPublicAccount: false,
    pendingFollowRequestsReceived: ['pending-viewer'],
  });
  const pending = createUser({
    id: 'pending',
    email: 'pending@example.com',
    isPublicAccount: true,
    name: 'Pending',
    username: 'pending',
  });
  const visibleData = {
    allUsers: [viewer, target, pending],
    blockRows: [],
    currentUser: viewer,
    lists: [createList()],
    users: [viewer, target, pending],
  };

  queryClient.setQueryData(queryKeys.visibleData.context('viewer'), visibleData);
  queryClient.setQueryData(queryKeys.visibleData.lists('viewer'), {
    pageParams: [0],
    pages: [[createList()]],
  });

  return visibleData;
}

describe('optimisticSocialCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  it('snapshots and restores matching queries', () => {
    queryClient.setQueryData(queryKeys.visibleData.context('viewer'), { value: 'before' });

    const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
    queryClient.setQueryData(queryKeys.visibleData.context('viewer'), { value: 'after' });
    restoreQueries(queryClient, snapshot);

    expect(queryClient.getQueryData(queryKeys.visibleData.context('viewer'))).toEqual({
      value: 'before',
    });
  });

  it('infers and applies follow states across visible data and explore results', () => {
    seedVisibleData(queryClient);
    queryClient.setQueryData(queryKeys.explore.page('viewer', 'all', ''), {
      pageParams: [null],
      pages: [
        {
          listItems: [{ list: createList({ userId: 'target' }), owner: null }],
          placeItems: [{ ownerId: 'target' }],
          userItems: [createUser({ id: 'target' })],
        },
      ],
    });

    expect(
      inferOptimisticFollowResult(queryClient, {
        currentUserId: 'viewer',
        targetUserId: 'target',
      }),
    ).toBe('unfollowed');
    expect(
      inferOptimisticFollowResult(queryClient, {
        currentUserId: 'viewer',
        targetUserId: 'pending',
      }),
    ).toBe('requested');
    expect(
      inferOptimisticFollowResult(queryClient, {
        currentUserId: 'viewer',
        targetUserId: 'new-private',
      }),
    ).toBe('following');

    applyOptimisticFollow(
      queryClient,
      {
        currentUserId: 'viewer',
        targetUserId: 'target',
      },
      'unfollowed',
    );

    const visibleData = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(
      queryKeys.visibleData.context('viewer'),
    );
    expect(visibleData?.currentUser?.following).toBeUndefined();
    expect(visibleData?.allUsers.find((user) => user.id === 'target')?.followers).toBeUndefined();

    applyOptimisticExploreFollow(queryClient, { targetUserId: 'target' }, 'following');
    const exploreData = queryClient.getQueryData<{
      pages: Array<{ listItems: unknown[]; placeItems: unknown[]; userItems: unknown[] }>;
    }>(queryKeys.explore.page('viewer', 'all', ''));
    expect(exploreData?.pages[0]).toEqual({
      listItems: [],
      placeItems: [],
      userItems: [],
    });
  });

  it('applies block and unblock changes to users, lists, and notifications', () => {
    seedVisibleData(queryClient);
    queryClient.setQueryData(queryKeys.notifications.page('viewer'), {
      pageParams: [0],
      pages: [[{ id: 'keep', userId: 'viewer' }, { id: 'drop', userId: 'target' }]],
    });

    applyOptimisticBlock(
      queryClient,
      {
        currentUserId: 'viewer',
        targetUserId: 'target',
      },
      createdAt,
    );

    const blockedVisibleData = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(
      queryKeys.visibleData.context('viewer'),
    );
    expect(blockedVisibleData?.currentUser?.blockedUsers).toEqual(['target']);
    expect(blockedVisibleData?.users.map((user) => user.id)).toEqual(['viewer', 'pending']);
    expect(blockedVisibleData?.lists).toEqual([]);

    const notificationData = queryClient.getQueryData<{ pages: Array<Array<{ id: string }>> }>(
      queryKeys.notifications.page('viewer'),
    );
    expect(notificationData?.pages[0]).toEqual([{ id: 'keep', userId: 'viewer' }]);

    applyOptimisticUnblock(queryClient, {
      currentUserId: 'viewer',
      targetUserId: 'target',
    });

    const unblockedVisibleData = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(
      queryKeys.visibleData.context('viewer'),
    );
    expect(unblockedVisibleData?.currentUser?.blockedUsers).toBeUndefined();
    expect(unblockedVisibleData?.blockRows).toEqual([]);
  });

  it('applies user, place, comment, and list optimistic updates', () => {
    seedVisibleData(queryClient);
    queryClient.setQueryData(queryKeys.placeComments.list('place-1', 'viewer'), {
      pageParams: [0],
      pages: [
        [
          {
            id: 'comment-1',
            list_place_id: 'place-1',
            user_id: 'target',
            parent_comment_id: null,
            content: 'Original',
            created_at: createdAt,
            updated_at: createdAt,
            list_place_comment_likes: [],
          },
        ],
      ],
    });

    applyOptimisticUserProfile(queryClient, {
      ...createUser({ id: 'target' }),
      name: 'Updated Target',
      username: 'UPDATED',
    });
    applyOptimisticPlaceLike(queryClient, { placeId: 'place-1', userId: 'viewer' }, createdAt);
    applyOptimisticCommentCreate(
      queryClient,
      {
        commentId: 'comment-2',
        content: 'New comment',
        placeId: 'place-1',
        userId: 'viewer',
      },
      createdAt,
    );
    applyOptimisticCommentCreate(
      queryClient,
      {
        commentId: 'reply-2',
        content: 'New reply',
        parentCommentId: 'comment-1',
        placeId: 'place-1',
        userId: 'viewer',
      },
      createdAt,
    );
    applyOptimisticCommentUpdate(
      queryClient,
      {
        commentId: 'comment-1',
        content: 'Edited',
      },
      createdAt,
    );
    applyOptimisticCommentLike(
      queryClient,
      {
        commentId: 'comment-1',
        userId: 'viewer',
      },
      createdAt,
    );
    applyOptimisticCommentDelete(queryClient, 'reply-1');

    const visibleData = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(
      queryKeys.visibleData.context('viewer'),
    );
    const place = visibleData?.lists?.[0]?.places[0];
    expect(visibleData?.allUsers.find((user) => user.id === 'target')).toMatchObject({
      name: 'Updated Target',
      username: 'updated',
    });
    expect(place?.likedBy).toEqual(['viewer']);
    expect(place?.comments?.[0]).toMatchObject({
      id: 'comment-2',
      content: 'New comment',
      isPending: true,
    });
    expect(place?.comments?.some((comment) => comment.id === 'reply-1')).toBe(false);
    expect(place?.comments?.find((comment) => comment.id === 'comment-1')).toMatchObject({
      content: 'Edited',
      likedBy: ['viewer'],
    });

    const newList = createList({ id: 'list-2', name: 'New list', places: [] });
    applyOptimisticListCreate(queryClient, newList);
    applyOptimisticListCreate(queryClient, newList);
    applyOptimisticListUpdate(queryClient, { ...newList, name: 'Updated list' });
    applyOptimisticListsUpdate(queryClient, [{ ...newList, name: 'Bulk updated list' }]);
    applyOptimisticPlaceDelete(queryClient, 'place-1');
    applyOptimisticListDelete(queryClient, 'list-1');

    const finalVisibleData = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(
      queryKeys.visibleData.context('viewer'),
    );
    expect(finalVisibleData?.lists?.map((list) => [list.id, list.name])).toEqual([
      ['list-2', 'Bulk updated list'],
    ]);
    expect(finalVisibleData?.lists?.[0]?.places).toEqual([]);
  });
});
