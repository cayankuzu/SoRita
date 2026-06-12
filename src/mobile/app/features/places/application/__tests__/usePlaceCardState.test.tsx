import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';

const updateListsAsyncMock = vi.fn();
const createListAsyncMock = vi.fn();
const toggleLikePlaceAsyncMock = vi.fn();
const createPlaceCommentAsyncMock = vi.fn();
const updatePlaceCommentAsyncMock = vi.fn();
const deletePlaceCommentAsyncMock = vi.fn();
const toggleLikePlaceCommentAsyncMock = vi.fn();
const reportPlaceAsyncMock = vi.fn();
const reportPlaceCommentAsyncMock = vi.fn();
const fetchNextPageMock = vi.fn();
let placeCommentsQueryResult: {
  data?: {
    pages: Array<Array<Record<string, unknown>>>;
  };
  fetchNextPage: typeof fetchNextPageMock;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};
let visibleDataQueryResult: {
  data: {
    allUsers?: Array<Record<string, unknown>>;
    blockRows?: Array<Record<string, unknown>>;
    lists: Array<Record<string, unknown>>;
    users: Array<Record<string, unknown>>;
  };
};

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: vi.fn(() => visibleDataQueryResult),
}));

vi.mock('@/mobile/app/data/hooks/useListMutations', () => ({
  useCreateListMutation: () => ({
    mutateAsync: createListAsyncMock,
  }),
  useUpdateListsMutation: () => ({
    mutateAsync: updateListsAsyncMock,
  }),
}));

vi.mock('@/mobile/app/data/hooks/usePlaceMutations', () => ({
  useCreatePlaceCommentMutation: () => ({ mutateAsync: createPlaceCommentAsyncMock }),
  useDeletePlaceCommentMutation: () => ({ mutateAsync: deletePlaceCommentAsyncMock }),
  useReportPlaceCommentMutation: () => ({ mutateAsync: reportPlaceCommentAsyncMock }),
  useReportPlaceMutation: () => ({ mutateAsync: reportPlaceAsyncMock }),
  useToggleLikePlaceCommentMutation: () => ({ mutateAsync: toggleLikePlaceCommentAsyncMock }),
  useToggleLikePlaceMutation: () => ({ mutateAsync: toggleLikePlaceAsyncMock }),
  useUpdatePlaceCommentMutation: () => ({ mutateAsync: updatePlaceCommentAsyncMock }),
}));

vi.mock('@/mobile/app/data/hooks/usePlaceCommentsQuery', () => ({
  usePlaceCommentsQuery: vi.fn(() => placeCommentsQueryResult),
}));

const showToastMock = vi.fn();

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

vi.mock('@/mobile/app/shared/i18n/tr', () => ({
  tr: {
    cards: {
      alreadyInList: 'already in list',
      commentDeleteFailed: 'comment delete failed',
      commentDeleted: 'comment deleted',
      commentLikeFailed: 'comment like failed',
      commentReportFailed: 'comment report failed',
      commentReported: 'comment reported',
      commentSendFailed: 'comment send failed',
      commentSent: 'comment sent',
      commentUpdateFailed: 'comment update failed',
      commentUpdated: 'comment updated',
      duplicateCommentReport: 'duplicate comment report',
      placeAddedToList: 'place added',
    },
  },
}));

vi.mock('@/shared/utils/id', () => ({
  createUuid: () => 'generated-place-id',
}));

describe('usePlaceCardState', () => {
  const wrapper = createQueryClientWrapper(createTestQueryClient());

  beforeEach(() => {
    placeCommentsQueryResult = {
      data: {
        pages: [],
      },
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    };
    visibleDataQueryResult = {
      data: {
        allUsers: [
          {
            id: 'user-1',
            name: 'Ada',
            username: 'ada',
          },
          {
            id: 'user-2',
            name: 'Ben',
            username: 'ben',
          },
        ],
        blockRows: [],
        lists: [
          {
            id: 'list-1',
            userId: 'user-1',
            name: 'My list',
            places: [],
          },
        ],
        users: [
          {
            id: 'user-1',
            name: 'Ada',
            username: 'ada',
          },
          {
            id: 'user-2',
            name: 'Ben',
            username: 'ben',
          },
        ],
      },
    };
    updateListsAsyncMock.mockReset();
    createListAsyncMock.mockReset();
    toggleLikePlaceAsyncMock.mockReset();
    createPlaceCommentAsyncMock.mockReset();
    updatePlaceCommentAsyncMock.mockReset();
    deletePlaceCommentAsyncMock.mockReset();
    toggleLikePlaceCommentAsyncMock.mockReset();
    reportPlaceAsyncMock.mockReset();
    reportPlaceCommentAsyncMock.mockReset();
    fetchNextPageMock.mockReset();
    showToastMock.mockReset();
  });

  it('adds a place to selected lists through the list update mutation', async () => {
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() =>
      usePlaceCardState({
        owner: {
          email: 'owner@example.com',
          id: 'owner-1',
          name: 'Owner',
          username: 'owner',
        },
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41.0,
          lng: 29.0,
          name: 'Cafe',
          comments: [],
          likes: 0,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    await act(async () => {
      await hook.result.current.savePlaceToLists(
        {
          address: 'Address',
          comments: [],
          lat: 41.0,
          likes: 0,
          lng: 29.0,
          name: 'Cafe',
          updatedAt: '2026-04-16T10:00:00.000Z',
        },
        ['list-1'],
      );
    });

    expect(updateListsAsyncMock).toHaveBeenCalledTimes(1);
    const nextLists = updateListsAsyncMock.mock.calls[0]?.[0];
    expect(nextLists).toHaveLength(1);
    expect(nextLists[0]?.places[0]).toMatchObject({
      id: 'generated-place-id',
      lat: 41.0,
      lng: 29.0,
      name: 'Cafe',
    });
    expect(showToastMock).toHaveBeenCalledWith('place added', 'success');
  });

  it('supports liking, commenting, reporting, and list creation flows', async () => {
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() =>
      usePlaceCardState({
        owner: {
          email: 'owner@example.com',
          id: 'owner-1',
          name: 'Owner',
          username: 'owner',
        },
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41.0,
          lng: 29.0,
          name: 'Cafe',
          comments: [
            {
              id: 'comment-1',
              userId: 'user-2',
              content: 'hello',
              createdAt: '2026-04-16T10:00:00.000Z',
              updatedAt: '2026-04-16T10:00:00.000Z',
              likedBy: ['user-1'],
              likeDetails: [{ userId: 'user-1', createdAt: '2026-04-16T10:00:00.000Z' }],
              author: {
                userId: 'user-2',
                name: 'Ben',
                username: 'ben',
              },
            },
          ],
          likedBy: ['user-1'],
          likeDetails: [{ userId: 'user-1', createdAt: '2026-04-16T10:00:00.000Z' }],
          likes: 1,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    expect(hook.result.current.isLiked).toBe(true);
    expect(hook.result.current.canReportPlace).toBe(true);
    expect(hook.result.current.comments).toHaveLength(1);
    expect(hook.result.current.likers).toHaveLength(1);

    await act(async () => {
      await hook.result.current.handleLikePress();
      await hook.result.current.handleCreateComment('new comment');
      await hook.result.current.handleUpdateComment('comment-1', 'updated');
      await hook.result.current.handleDeleteComment('comment-1');
      await hook.result.current.handleToggleCommentLike('comment-1');
      await hook.result.current.handleReportComment('comment-1', 'spam');
      await hook.result.current.handleReportPlace('spam');
      await hook.result.current.createList({
        id: 'list-2',
        userId: '',
        name: 'Weekend',
        places: [],
        isPublic: true,
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      });
    });

    expect(toggleLikePlaceAsyncMock).toHaveBeenCalledWith({
      placeId: 'place-1',
      userId: 'user-1',
    });
    expect(createPlaceCommentAsyncMock).toHaveBeenCalledWith({
      placeId: 'place-1',
      userId: 'user-1',
      content: 'new comment',
      parentCommentId: undefined,
    });
    expect(updatePlaceCommentAsyncMock).toHaveBeenCalledWith({
      commentId: 'comment-1',
      userId: 'user-1',
      content: 'updated',
    });
    expect(deletePlaceCommentAsyncMock).toHaveBeenCalledWith('comment-1');
    expect(toggleLikePlaceCommentAsyncMock).toHaveBeenCalledWith({
      commentId: 'comment-1',
      userId: 'user-1',
    });
    expect(reportPlaceCommentAsyncMock).toHaveBeenCalledWith({
      commentId: 'comment-1',
      reporterUserId: 'user-1',
      reason: 'spam',
    });
    expect(reportPlaceAsyncMock).toHaveBeenCalledWith({
      reporterUserId: 'user-1',
      placeId: 'place-1',
      reason: 'spam',
    });
    expect(createListAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        name: 'Weekend',
      }),
    );
  });

  it('guards unauthenticated actions', async () => {
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() =>
      usePlaceCardState({
        ownerId: 'owner-1',
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41.0,
          lng: 29.0,
          name: 'Cafe',
          comments: [],
          likes: 0,
        },
        user: null,
      }), { wrapper });

    expect(hook.result.current.canReportPlace).toBe(false);

    await act(async () => {
      await expect(hook.result.current.handleLikePress()).rejects.toThrow('Begeni icin giris yapmalisin');
      await expect(hook.result.current.handleCreateComment('hello')).rejects.toThrow('Yorum icin giris yapmalisin');
      await expect(hook.result.current.handleUpdateComment('comment-1', 'hello')).rejects.toThrow('comment update failed');
      await expect(hook.result.current.handleReportComment('comment-1', 'spam')).rejects.toThrow('comment report failed');
      await expect(hook.result.current.handleToggleCommentLike('comment-1')).rejects.toThrow('comment like failed');
      await expect(hook.result.current.handleReportPlace('spam')).rejects.toThrow('Mekani bildirmek icin giris yapmalisin');
      await hook.result.current.savePlaceToLists(
        {
          comments: [],
          lat: 41,
          likes: 0,
          lng: 29,
          name: 'Cafe',
        },
        ['list-1'],
      );
      await hook.result.current.createList({
        id: 'list-2',
        userId: '',
        name: 'Weekend',
        places: [],
        isPublic: true,
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      });
    });

    expect(updateListsAsyncMock).not.toHaveBeenCalled();
    expect(createListAsyncMock).not.toHaveBeenCalled();
  });

  it('reports list-target validation failures before saving', async () => {
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() =>
      usePlaceCardState({
        ownerId: 'owner-1',
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41.0,
          lng: 29.0,
          name: 'Cafe',
          comments: [],
          likes: 0,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    await act(async () => {
      await hook.result.current.savePlaceToLists(
        {
          comments: [],
          lat: 41.0,
          likes: 0,
          lng: 29.0,
          name: 'Cafe',
        },
        ['missing-list'],
      );
    });
    expect(showToastMock).toHaveBeenCalledWith('Liste bulunamadi', 'error');

    visibleDataQueryResult = {
      data: {
        allUsers: visibleDataQueryResult.data.allUsers,
        blockRows: [],
        lists: [
          {
            id: 'list-1',
            userId: 'user-1',
            name: 'My list',
            places: [
              {
                id: 'place-1',
                lat: 41.0,
                lng: 29.0,
                name: 'Cafe',
                addedAt: '2026-04-16T10:00:00.000Z',
              },
            ],
          },
        ],
        users: visibleDataQueryResult.data.users,
      },
    };
    const duplicateHook = renderHook(() =>
      usePlaceCardState({
        ownerId: 'owner-1',
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41.0,
          lng: 29.0,
          name: 'Cafe',
          comments: [],
          likes: 0,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    await act(async () => {
      await duplicateHook.result.current.savePlaceToLists(
        {
          comments: [],
          lat: 41.0,
          likes: 0,
          lng: 29.0,
          name: 'Cafe',
        },
        ['list-1'],
      );
    });
    expect(showToastMock).toHaveBeenCalledWith('already in list', 'error');
  });

  it('maps mutation failures to user-facing errors', async () => {
    toggleLikePlaceAsyncMock.mockRejectedValueOnce(new Error('backend like failed'));
    createPlaceCommentAsyncMock.mockRejectedValueOnce(new Error('backend comment failed'));
    updatePlaceCommentAsyncMock.mockRejectedValueOnce(new Error('backend update failed'));
    deletePlaceCommentAsyncMock.mockRejectedValueOnce(new Error('backend delete failed'));
    reportPlaceCommentAsyncMock
      .mockRejectedValueOnce({ code: '23505' })
      .mockRejectedValueOnce(new Error('backend report failed'));
    toggleLikePlaceCommentAsyncMock.mockRejectedValueOnce(new Error('custom like failed'));
    reportPlaceAsyncMock
      .mockRejectedValueOnce({ code: '23505' })
      .mockRejectedValueOnce(new Error('backend place report failed'));

    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() =>
      usePlaceCardState({
        ownerId: 'owner-2',
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41.0,
          lng: 29.0,
          name: 'Cafe',
          comments: [],
          likes: 0,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    await act(async () => {
      await expect(hook.result.current.handleLikePress()).rejects.toThrow('Mekan begenisi guncellenemedi');
      await expect(hook.result.current.handleCreateComment('hello')).rejects.toThrow('comment send failed');
      await expect(hook.result.current.handleUpdateComment('comment-1', 'hello')).rejects.toThrow('comment update failed');
      await expect(hook.result.current.handleDeleteComment('comment-1')).rejects.toThrow('comment delete failed');
      await expect(hook.result.current.handleReportComment('comment-1', 'spam')).rejects.toThrow('duplicate comment report');
      await expect(hook.result.current.handleReportComment('comment-1', 'spam')).rejects.toThrow('comment report failed');
      await expect(hook.result.current.handleToggleCommentLike('comment-1')).rejects.toThrow('custom like failed');
      await expect(hook.result.current.handleReportPlace('spam')).rejects.toThrow('Bu mekan kartini zaten bildirdin');
      await expect(hook.result.current.handleReportPlace('spam')).rejects.toThrow('backend place report failed');
    });
  });

  it('hydrates paginated comments and filters blocked users from the thread', async () => {
    visibleDataQueryResult = {
      data: {
        allUsers: [
          { id: 'user-1', name: 'Ada', username: 'ada' },
          { id: 'user-2', name: 'Ben', username: 'ben' },
          { id: 'user-3', name: 'Blocked', username: 'blocked' },
        ],
        blockRows: [
          {
            blocker_user_id: 'user-1',
            blocked_user_id: 'user-3',
            created_at: '2026-04-16T10:00:00.000Z',
          },
        ],
        lists: [],
        users: [
          { id: 'user-1', name: 'Ada', username: 'ada' },
          { id: 'user-2', name: 'Ben', username: 'ben' },
        ],
      },
    };
    placeCommentsQueryResult = {
      data: {
        pages: [[
          {
            id: 'comment-1',
            list_place_id: 'place-1',
            user_id: 'user-2',
            parent_comment_id: null,
            content: 'visible comment',
            created_at: '2026-04-16T10:00:00.000Z',
            updated_at: '2026-04-16T10:00:00.000Z',
            list_place_comment_likes: [{ comment_id: 'comment-1', user_id: 'user-1', created_at: '2026-04-16T10:00:00.000Z' }],
          },
          {
            id: 'comment-2',
            list_place_id: 'place-1',
            user_id: 'user-3',
            parent_comment_id: 'comment-1',
            content: 'blocked reply',
            created_at: '2026-04-16T10:05:00.000Z',
            updated_at: '2026-04-16T10:05:00.000Z',
            list_place_comment_likes: [],
          },
        ]],
      },
      fetchNextPage: fetchNextPageMock,
      hasNextPage: false,
      isFetchingNextPage: false,
    };
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() =>
      usePlaceCardState({
        ownerId: 'owner-1',
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41.0,
          lng: 29.0,
          name: 'Cafe',
          comments: [],
          likes: 0,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.comments).toHaveLength(1);
      expect(hook.result.current.comments[0]?.userName).toBe('Ben');
      expect(hook.result.current.comments[0]?.replies).toEqual([]);
      expect(hook.result.current.hasNextCommentsPage).toBe(false);
    });
  });
});
