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

  it('handles absent snapshots and ignores malformed cache shapes without throwing', () => {
    restoreQueries(queryClient);
    const malformedValues = [null, [], {}, { pages: [] }, { pageParams: [] }];
    malformedValues.forEach((value, index) => {
      queryClient.setQueryData([...queryKeys.visibleData.all, `bad-${index}`], value);
      queryClient.setQueryData([...queryKeys.notifications.all, `bad-${index}`], value);
      queryClient.setQueryData([...queryKeys.explore.all, `bad-${index}`], value);
    });
    expect(() => {
      applyOptimisticFollow(queryClient, { currentUserId: 'viewer', targetUserId: 'target' }, 'following');
      applyOptimisticExploreFollow(queryClient, { targetUserId: 'target' }, 'following');
      applyOptimisticBlock(queryClient, { currentUserId: 'viewer', targetUserId: 'target' }, createdAt);
      applyOptimisticUnblock(queryClient, { currentUserId: 'viewer', targetUserId: 'target' });
      applyOptimisticPlaceLike(queryClient, { placeId: 'missing', userId: 'viewer' }, createdAt);
      applyOptimisticCommentDelete(queryClient, 'missing');
      applyOptimisticListDelete(queryClient, 'missing');
      applyOptimisticPlaceDelete(queryClient, 'missing');
    }).not.toThrow();
  });

  it('applies following/requested states to both sides and infers users from allUsers', () => {
    const viewer = createUser({ id: 'viewer', following: undefined, pendingFollowRequestsSent: undefined });
    const publicTarget = createUser({ id: 'target', isPublicAccount: true, followers: undefined });
    const privateTarget = createUser({ id: 'private', isPublicAccount: false });
    queryClient.setQueryData(queryKeys.visibleData.context('viewer'), {
      allUsers: [viewer, publicTarget, privateTarget], blockRows: [], currentUser: null,
      users: [viewer, publicTarget, privateTarget], lists: [],
    });
    expect(inferOptimisticFollowResult(queryClient, {
      currentUserId: 'viewer', targetUserId: 'target',
    })).toBe('following');
    expect(inferOptimisticFollowResult(queryClient, {
      currentUserId: 'viewer', targetUserId: 'private',
    })).toBe('requested');

    applyOptimisticFollow(queryClient, { currentUserId: 'viewer', targetUserId: 'target' }, 'following');
    let data = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(queryKeys.visibleData.context('viewer'));
    expect(data?.allUsers.find((user) => user.id === 'viewer')?.following).toEqual(['target']);
    expect(data?.allUsers.find((user) => user.id === 'target')?.followers).toEqual(['viewer']);

    applyOptimisticFollow(queryClient, { currentUserId: 'viewer', targetUserId: 'private' }, 'requested');
    data = queryClient.getQueryData(queryKeys.visibleData.context('viewer'));
    expect(data?.allUsers.find((user) => user.id === 'viewer')?.pendingFollowRequestsSent).toEqual(['private']);
    expect(data?.allUsers.find((user) => user.id === 'private')?.pendingFollowRequestsReceived).toEqual(['viewer']);

    queryClient.setQueryData(queryKeys.explore.page('viewer', 'all', ''), {
      pageParams: [null], pages: [{ listItems: [], placeItems: [], userItems: [publicTarget] }],
    });
    applyOptimisticExploreFollow(queryClient, { targetUserId: 'target' }, 'unfollowed');
    expect(queryClient.getQueryData(queryKeys.explore.page('viewer', 'all', ''))).toBeTruthy();
  });

  it('restores a filtered target on unblock and toggles like details back to empty', () => {
    seedVisibleData(queryClient);
    applyOptimisticBlock(queryClient, { currentUserId: 'viewer', targetUserId: 'target' }, createdAt);
    applyOptimisticUnblock(queryClient, { currentUserId: 'viewer', targetUserId: 'target' });
    const restored = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(
      queryKeys.visibleData.context('viewer'),
    );
    expect(restored?.users.some((user) => user.id === 'target')).toBe(true);
    expect(restored?.allUsers.find((user) => user.id === 'target')?.blockedByUsers).toBeUndefined();

    seedVisibleData(queryClient);
    applyOptimisticPlaceLike(queryClient, { placeId: 'place-1', userId: 'viewer' }, createdAt);
    applyOptimisticPlaceLike(queryClient, { placeId: 'place-1', userId: 'viewer' }, createdAt);
    const data = queryClient.getQueryData<ReturnType<typeof seedVisibleData>>(
      queryKeys.visibleData.context('viewer'),
    );
    expect(data?.lists?.[0]?.places[0]).toMatchObject({ likes: 0, likedBy: undefined, likeDetails: undefined });
  });

  it('creates comments in empty caches, preserves missing parents, and toggles raw likes', () => {
    seedVisibleData(queryClient);
    queryClient.setQueryData(queryKeys.placeComments.list('place-1', 'viewer'), {
      pageParams: [], pages: [],
    });
    applyOptimisticCommentCreate(queryClient, {
      commentId: 'first', content: 'First', placeId: 'place-1', userId: 'viewer', parentCommentId: null,
    }, createdAt);
    expect(queryClient.getQueryData(queryKeys.placeComments.list('place-1', 'viewer'))).toMatchObject({
      pages: [[expect.objectContaining({ id: 'first', parent_comment_id: null })]],
    });
    applyOptimisticCommentCreate(queryClient, {
      commentId: 'orphan', content: 'Orphan', placeId: 'place-1', userId: 'viewer', parentCommentId: 'missing',
    }, createdAt);

    queryClient.setQueryData(queryKeys.placeComments.list('place-1', 'viewer'), {
      pageParams: [0],
      pages: [[
        {
          id: 'comment-1', list_place_id: 'place-1', user_id: 'target', parent_comment_id: null,
          content: 'Original', created_at: createdAt, updated_at: createdAt,
          list_place_comment_likes: null,
        },
        {
          id: 'other', list_place_id: 'place-1', user_id: 'target', parent_comment_id: null,
          content: 'Other', created_at: createdAt, updated_at: createdAt,
          list_place_comment_likes: [],
        },
      ]],
    });
    applyOptimisticCommentLike(queryClient, { commentId: 'comment-1', userId: 'viewer' }, createdAt);
    applyOptimisticCommentLike(queryClient, { commentId: 'comment-1', userId: 'viewer' }, createdAt);
    const rows = queryClient.getQueryData<{ pages: Array<Array<{ id: string; list_place_comment_likes: unknown[] }>> }>(
      queryKeys.placeComments.list('place-1', 'viewer'),
    );
    expect(rows?.pages[0]?.find((row) => row.id === 'comment-1')?.list_place_comment_likes).toEqual([]);
    expect(rows?.pages[0]?.find((row) => row.id === 'other')?.list_place_comment_likes).toEqual([]);
  });

  it('updates and deletes lists/places inside infinite list caches', () => {
    const list = createList();
    queryClient.setQueryData(queryKeys.visibleData.lists('viewer'), {
      pageParams: [0], pages: [[list]],
    });
    applyOptimisticUserProfile(queryClient, createUser({ id: 'unrelated', username: 'UPPER' }));
    applyOptimisticListCreate(queryClient, createList({ id: 'list-2' }));
    applyOptimisticListUpdate(queryClient, { ...list, name: 'Updated' });
    applyOptimisticListsUpdate(queryClient, [{ ...list, name: 'Bulk' }]);
    applyOptimisticPlaceDelete(queryClient, 'place-1');
    applyOptimisticListDelete(queryClient, 'list-2');
    const data = queryClient.getQueryData<{ pages: PlaceList[][] }>(queryKeys.visibleData.lists('viewer'));
    expect(data?.pages[0]).toEqual([expect.objectContaining({ id: 'list-1', name: 'Bulk', places: [] })]);
  });
});
