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
const createPlaceQuoteNotificationMock = vi.fn();
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

vi.mock('@/mobile/app/data/hooks/useNotificationMutations', () => ({
  useCreatePlaceQuoteNotificationMutation: () => ({
    mutateAsync: createPlaceQuoteNotificationMock,
  }),
}));

vi.mock('@/mobile/app/shared/i18n/tr', () => ({
  tr: {
    categories: {
      other: 'Diger',
    },
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
      listNotFound: 'Liste bulunamadi',
      loginRequiredForComment: 'Yorum icin giris yapmalisin',
      loginRequiredForLike: 'Begeni icin giris yapmalisin',
      loginRequiredForReport: 'Mekani bildirmek icin giris yapmalisin',
      placeAddedToList: 'place added',
      placeAlreadyReported: 'Bu mekan kartini zaten bildirdin',
      placeLikeUpdateFailed: 'Mekan begenisi guncellenemedi',
      placeReportFailed: 'Mekan karti bildirilemedi',
    },
    placeEditor: {
      notices: {
        selectionLimit: (max: number) =>
          `Bir mekani ayni anda en fazla ${max} listeye ekleyebilirsin`,
      },
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
    createPlaceQuoteNotificationMock.mockReset();
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

  it('sends quote notifications to the attribution owner when one exists', async () => {
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
          sourceAttribution: {
            placeId: 'source-place-1',
            placeName: 'Original Cafe',
            userId: 'source-user-1',
            userName: 'Source Owner',
          },
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
          updatedAt: '2026-04-16T10:00:00.000Z',
        },
        ['list-1'],
      );
    });

    expect(createPlaceQuoteNotificationMock).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      listId: 'list-1',
      message: '"Original Cafe" mekânını kendi listesine alıntıladı',
      placeId: 'generated-place-id',
      recipientUserId: 'source-user-1',
    });
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
      commentId: 'generated-place-id',
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
      details: undefined,
      reporterUserId: 'user-1',
      reason: 'spam',
    });
    expect(reportPlaceAsyncMock).toHaveBeenCalledWith({
      details: undefined,
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
      await expect(hook.result.current.handleCreateComment('hello')).rejects.toThrow('backend comment failed');
      await expect(hook.result.current.handleUpdateComment('comment-1', 'hello')).rejects.toThrow('backend update failed');
      await expect(hook.result.current.handleDeleteComment('comment-1')).rejects.toThrow('backend delete failed');
      await expect(hook.result.current.handleReportComment('comment-1', 'spam')).rejects.toThrow('duplicate comment report');
      await expect(hook.result.current.handleReportComment('comment-1', 'spam')).rejects.toThrow('backend report failed');
      await expect(hook.result.current.handleToggleCommentLike('comment-1')).rejects.toThrow('custom like failed');
      await expect(hook.result.current.handleReportPlace('spam')).rejects.toThrow('Bu mekan kartini zaten bildirdin');
      await expect(hook.result.current.handleReportPlace('spam')).rejects.toThrow('backend place report failed');
    });
  });

  it('marks own expired comments so the UI can block late edits', async () => {
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
          comments: [
            {
              id: 'comment-1',
              userId: 'user-1',
              content: 'old comment',
              createdAt: '2026-04-16T10:00:00.000Z',
              updatedAt: '2026-04-16T10:00:00.000Z',
              author: {
                userId: 'user-1',
                name: 'Ada',
                username: 'ada',
              },
            },
          ],
          likes: 0,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    expect(hook.result.current.comments[0]?.canEdit).toBe(true);
    expect(hook.result.current.comments[0]?.editWindowExpired).toBe(true);
  });

  it('keeps optimistic comments read-only until the server sync finishes', async () => {
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
          comments: [
            {
              id: 'comment-1',
              userId: 'user-1',
              content: 'pending comment',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isPending: true,
              author: {
                userId: 'user-1',
                name: 'Ada',
                username: 'ada',
              },
            },
          ],
          likes: 0,
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
        },
      }), { wrapper });

    expect(hook.result.current.comments[0]?.pendingSync).toBe(true);
    expect(hook.result.current.comments[0]?.canEdit).toBe(false);
    expect(hook.result.current.comments[0]?.canDelete).toBe(false);
    expect(hook.result.current.comments[0]?.editWindowExpired).toBe(false);
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

  it('can skip loading personal lists until the add-to-list flow is opened', async () => {
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const { useVisibleDataQuery } = await import('@/mobile/app/data/hooks/useVisibleDataQuery');
    const visibleDataQueryMock = vi.mocked(useVisibleDataQuery);

    renderHook(() =>
      usePlaceCardState({
        listsEnabled: false,
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

    expect(visibleDataQueryMock).toHaveBeenNthCalledWith(1, 'user-1', {
      enabled: false,
      includeLists: false,
      includePlaceComments: false,
      listPageSize: 100,
      ownerId: 'user-1',
    });
  });

  it('exposes source attribution navigation rules for public and private users', async () => {
    visibleDataQueryResult = {
      data: {
        allUsers: [
          {
            id: 'user-1',
            email: 'ada@example.com',
            name: 'Ada',
            username: 'ada',
            following: [],
          },
          {
            id: 'user-2',
            email: 'ben@example.com',
            name: 'Ben',
            username: 'ben',
            isPublicAccount: false,
            followers: [],
          },
          {
            id: 'user-3',
            email: 'eve@example.com',
            name: 'Eve',
            username: 'eve',
            isPublicAccount: true,
          },
        ],
        blockRows: [],
        lists: [],
        users: [
          {
            id: 'user-1',
            email: 'ada@example.com',
            name: 'Ada',
            username: 'ada',
            following: [],
          },
          {
            id: 'user-3',
            email: 'eve@example.com',
            name: 'Eve',
            username: 'eve',
            isPublicAccount: true,
          },
        ],
      },
    };

    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const privateSourceHook = renderHook(() =>
      usePlaceCardState({
        ownerId: 'owner-1',
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-1',
          lat: 41,
          lng: 29,
          name: 'Cafe',
          sourceAttribution: {
            placeId: 'source-place',
            userId: 'user-2',
            userName: 'Ben',
          },
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
          following: [],
        },
      }), { wrapper });

    expect(privateSourceHook.result.current.sourceAttributionUserId).toBe('user-2');
    expect(privateSourceHook.result.current.canOpenSourcePlaceCard).toBe(false);

    const publicSourceHook = renderHook(() =>
      usePlaceCardState({
        ownerId: 'owner-1',
        place: {
          addedAt: '2026-04-16T10:00:00.000Z',
          id: 'place-2',
          lat: 41,
          lng: 29,
          name: 'Cafe',
          sourceAttribution: {
            placeId: 'source-place',
            userId: 'user-3',
            userName: 'Eve',
          },
        },
        user: {
          email: 'ada@example.com',
          id: 'user-1',
          name: 'Ada',
          username: 'ada',
          following: [],
        },
      }), { wrapper });

    expect(publicSourceHook.result.current.sourceAttributionUserId).toBe('user-3');
    expect(publicSourceHook.result.current.canOpenSourcePlaceCard).toBe(true);
  });

  it('enforces privacy and sanitizes recursive comment metadata at the pure boundary', async () => {
    const { placeCardInternals } = await import(
      '@/mobile/app/features/places/application/usePlaceCardState'
    );
    const viewer = {
      id: 'viewer', email: 'viewer@example.com', name: 'Viewer', username: 'viewer',
      following: ['followed'],
    };
    const publicUser = {
      id: 'public', email: 'public@example.com', name: 'Public', username: 'public',
      isPublicAccount: true,
    };
    const privateUser = {
      id: 'private', email: 'private@example.com', name: 'Private', username: 'private',
      isPublicAccount: false, followers: [],
    };
    const followedUser = { ...privateUser, id: 'followed', username: 'followed' };
    const followerUser = { ...privateUser, id: 'follower', username: 'follower', followers: ['viewer'] };
    const hidden = new Set(['hidden']);

    expect(placeCardInternals.canViewPrivateUserContent(viewer, null, hidden)).toBe(true);
    expect(placeCardInternals.canViewPrivateUserContent(null, publicUser, hidden)).toBe(true);
    expect(placeCardInternals.canViewPrivateUserContent(null, privateUser, hidden)).toBe(false);
    expect(placeCardInternals.canViewPrivateUserContent(viewer, viewer, hidden)).toBe(true);
    expect(placeCardInternals.canViewPrivateUserContent(
      viewer, { ...privateUser, id: 'hidden' }, hidden,
    )).toBe(false);
    expect(placeCardInternals.canViewPrivateUserContent(viewer, publicUser, hidden)).toBe(true);
    expect(placeCardInternals.canViewPrivateUserContent(viewer, followedUser, hidden)).toBe(true);
    expect(placeCardInternals.canViewPrivateUserContent(viewer, followerUser, hidden)).toBe(true);
    expect(placeCardInternals.canViewPrivateUserContent(viewer, privateUser, hidden)).toBe(false);

    const comment = {
      id: 'comment', userId: 'author', content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
      author: { userId: 'author', name: 'Author', username: 'author' },
      likedBy: ['viewer', 'hidden'],
      likeDetails: [
        { userId: 'viewer', createdAt: '2025-01-02T00:00:00.000Z' },
        { userId: 'hidden', createdAt: '2025-01-03T00:00:00.000Z' },
      ],
      replies: [
        {
          id: 'reply-visible', userId: 'viewer', content: 'reply',
          createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
          likedBy: [], likeDetails: [], replies: [],
        },
        {
          id: 'reply-hidden', userId: 'hidden', content: 'hidden',
          createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };
    const sanitized = placeCardInternals.sanitizeCommentTree(comment, hidden);
    expect(sanitized).toMatchObject({
      likes: 1, likedBy: ['viewer'],
      likeDetails: [{ userId: 'viewer' }],
      replies: [{ id: 'reply-visible' }],
    });
    expect(placeCardInternals.sanitizeCommentTree(comment, new Set(['author']))).toBeNull();

    const users = new Map([
      ['viewer', viewer],
      ['author', { id: 'author', email: '', name: 'Author', username: 'author', following: [] }],
    ]);
    const mapped = placeCardInternals.mapCommentToFeedAction(
      sanitized!, (userId) => users.get(userId), 'viewer', 'viewer',
    );
    expect(mapped).toMatchObject({
      userName: 'Author', liked: true, canReport: true, canDelete: true,
      likers: [{ id: 'viewer', likedAt: '2025-01-02T00:00:00.000Z' }],
      replies: [{ canEdit: true, canDelete: true, canReport: false }],
    });
    const anonymous = placeCardInternals.mapCommentToFeedAction(
      {
        id: 'anonymous', userId: 'unknown', content: 'anonymous',
        createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z',
      },
      () => undefined,
    );
    expect(anonymous).toMatchObject({
      userName: 'SoRita', likes: 0, liked: false, likers: [], replies: [],
      canEdit: false, canDelete: false, canReport: false,
    });

    expect(placeCardInternals.getErrorMessage(new Error('specific'), 'fallback')).toBe('specific');
    expect(placeCardInternals.getErrorMessage(new Error('  '), 'fallback')).toBe('fallback');
    expect(placeCardInternals.getErrorMessage('failure', 'fallback')).toBe('fallback');
    const cause = { code: 'failure' };
    expect(placeCardInternals.createErrorWithCause('message', cause)).toMatchObject({
      message: 'message', cause,
    });
  });

  it('resolves source attribution list, place, and owner context when navigation is enabled', async () => {
    const sourcePlace = {
      id: 'source-place', name: 'Source cafe', lat: 41, lng: 29,
      addedAt: '2026-04-16T10:00:00.000Z',
    };
    visibleDataQueryResult = {
      data: {
        allUsers: [
          { id: 'user-1', email: '', name: 'Ada', username: 'ada' },
          { id: 'source-owner', email: '', name: 'Source Owner', username: 'source' },
        ],
        blockRows: [],
        lists: [{
          id: 'source-list', userId: 'source-owner', name: 'Source list', places: [sourcePlace],
          isPublic: true, createdAt: '2026-04-16T10:00:00.000Z',
          updatedAt: '2026-04-16T10:00:00.000Z',
        }],
        users: [{ id: 'user-1', email: '', name: 'Ada', username: 'ada' }],
      },
    };
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() => usePlaceCardState({
      sourceAttributionEnabled: true,
      place: {
        id: 'quoted-place', name: 'Quoted', lat: 40, lng: 30,
        addedAt: '2026-04-16T10:00:00.000Z',
        sourceAttribution: {
          listId: 'source-list', placeId: 'source-place', userId: 'source-owner',
          userName: 'Source Owner',
        },
      },
      user: { id: 'user-1', email: '', name: 'Ada', username: 'ada' },
    }), { wrapper });

    expect(hook.result.current.sourceAttributionList?.id).toBe('source-list');
    expect(hook.result.current.sourceAttributionPlace?.id).toBe('source-place');
    expect(hook.result.current.sourceAttributionOwner?.id).toBe('source-owner');
    expect(hook.result.current.sourceAttributionUser?.id).toBe('source-owner');
    expect(hook.result.current.canOpenSourcePlaceCard).toBe(true);
  });

  it('enforces selection caps and coordinate duplicate detection before list writes', async () => {
    visibleDataQueryResult = {
      data: {
        allUsers: [], blockRows: [], users: [],
        lists: [{
          id: 'list-1', userId: 'user-1', name: 'My list',
          places: [{
            id: 'different-id', name: 'Cafe', lat: 41, lng: 29,
            addedAt: '2026-04-16T10:00:00.000Z',
          }],
        }],
      },
    };
    const { usePlaceCardState } = await import('@/mobile/app/features/places/application/usePlaceCardState');
    const hook = renderHook(() => usePlaceCardState({
      place: {
        id: 'place-1', name: 'Cafe', lat: 41, lng: 29,
        addedAt: '2026-04-16T10:00:00.000Z',
      },
      user: { id: 'user-1', email: '', name: 'Ada', username: 'ada' },
    }), { wrapper });
    const placeData = { name: 'Cafe', lat: 41, lng: 29 };

    await expect(hook.result.current.savePlaceToLists(
      placeData, ['one', 'two', 'three', 'four'],
    )).resolves.toBe(false);
    await expect(hook.result.current.savePlaceToLists(placeData, ['list-1'])).resolves.toBe(false);
    expect(updateListsAsyncMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('already in list', 'error');

    await expect(hook.result.current.createList({
      id: 'list-2', userId: '', name: 'New', places: [], isPublic: true,
      createdAt: '2026-04-16T10:00:00.000Z', updatedAt: '2026-04-16T10:00:00.000Z',
    })).resolves.toBeUndefined();
    expect(createListAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });
});
