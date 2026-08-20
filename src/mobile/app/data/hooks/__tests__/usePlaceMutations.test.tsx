import { onlineManager } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const deletePlaceMock = vi.fn();
const toggleLikePlaceMock = vi.fn();
const createPlaceCommentMock = vi.fn();
const updatePlaceCommentMock = vi.fn();
const deletePlaceCommentMock = vi.fn();
const toggleLikePlaceCommentMock = vi.fn();
const reportPlaceMock = vi.fn();
const reportPlaceCommentMock = vi.fn();
const enqueueDurableOutboxEntryMock = vi.fn();

vi.mock('@/mobile/app/data/outbox/enqueueDurableOutboxEntry', () => ({
  enqueueDurableOutboxEntry: enqueueDurableOutboxEntryMock,
}));

vi.mock('@/mobile/app/data/repositories/placesRepository', () => ({
  createPlaceComment: createPlaceCommentMock,
  deletePlace: deletePlaceMock,
  deletePlaceComment: deletePlaceCommentMock,
  reportPlace: reportPlaceMock,
  reportPlaceComment: reportPlaceCommentMock,
  toggleLikePlace: toggleLikePlaceMock,
  toggleLikePlaceComment: toggleLikePlaceCommentMock,
  updatePlaceComment: updatePlaceCommentMock,
}));

describe('usePlaceMutations', () => {
  beforeEach(() => {
    deletePlaceMock.mockReset();
    toggleLikePlaceMock.mockReset();
    createPlaceCommentMock.mockReset();
    updatePlaceCommentMock.mockReset();
    deletePlaceCommentMock.mockReset();
    toggleLikePlaceCommentMock.mockReset();
    reportPlaceMock.mockReset();
    reportPlaceCommentMock.mockReset();
    enqueueDurableOutboxEntryMock.mockReset();
    enqueueDurableOutboxEntryMock.mockResolvedValue(undefined);
    onlineManager.setOnline(true);
  });

  it('invalidates visible data for mutating place state', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const hooks = await import('@/mobile/app/data/hooks/usePlaceMutations');

    deletePlaceMock.mockResolvedValue(undefined);
    toggleLikePlaceMock.mockResolvedValue(undefined);
    createPlaceCommentMock.mockResolvedValue(undefined);
    updatePlaceCommentMock.mockResolvedValue(undefined);
    deletePlaceCommentMock.mockResolvedValue(undefined);
    toggleLikePlaceCommentMock.mockResolvedValue(undefined);

    const deleteHook = renderHook(() => hooks.useDeletePlaceMutation(), { wrapper });
    const likePlaceHook = renderHook(() => hooks.useToggleLikePlaceMutation(), { wrapper });
    const createCommentHook = renderHook(() => hooks.useCreatePlaceCommentMutation(), { wrapper });
    const updateCommentHook = renderHook(() => hooks.useUpdatePlaceCommentMutation(), { wrapper });
    const deleteCommentHook = renderHook(() => hooks.useDeletePlaceCommentMutation(), { wrapper });
    const likeCommentHook = renderHook(() => hooks.useToggleLikePlaceCommentMutation(), { wrapper });

    await act(async () => {
      await deleteHook.result.current.mutateAsync('place-1');
      await likePlaceHook.result.current.mutateAsync({ placeId: 'place-1', userId: 'viewer-1' });
      await createCommentHook.result.current.mutateAsync({
        commentId: 'comment-created-1',
        placeId: 'place-1',
        userId: 'viewer-1',
        content: 'hello',
      });
      await updateCommentHook.result.current.mutateAsync({
        commentId: 'comment-1',
        userId: 'viewer-1',
        content: 'updated',
      });
      await deleteCommentHook.result.current.mutateAsync('comment-1');
      await likeCommentHook.result.current.mutateAsync({
        commentId: 'comment-1',
        userId: 'viewer-1',
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.visibleData.all,
      });
    });
  });

  it('optimistically updates place likes before the request finishes', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const listQueryKey = queryKeys.visibleData.lists('viewer-1', { publicOnly: true });
    const hooks = await import('@/mobile/app/data/hooks/usePlaceMutations');
    let resolveLike: (() => void) | undefined;

    queryClient.setQueryData(listQueryKey, {
      pageParams: [0],
      pages: [[
        {
          id: 'list-1',
          userId: 'owner-1',
          name: 'List',
          places: [
            {
              id: 'place-1',
              name: 'Cafe',
              lat: 41,
              lng: 29,
              addedAt: '2026-04-16T10:00:00.000Z',
              likes: 0,
            },
          ],
          isPublic: true,
          createdAt: '2026-04-16T10:00:00.000Z',
          updatedAt: '2026-04-16T10:00:00.000Z',
        },
      ]],
    });
    toggleLikePlaceMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLike = resolve;
      }),
    );

    const likePlaceHook = renderHook(() => hooks.useToggleLikePlaceMutation(), { wrapper });

    act(() => {
      likePlaceHook.result.current.mutate({ placeId: 'place-1', userId: 'viewer-1' });
    });

    await waitFor(() => {
      const cache = queryClient.getQueryData<{
        pages: Array<Array<{ places: Array<{ likedBy?: string[]; likes?: number }> }>>;
      }>(listQueryKey);
      expect(cache?.pages[0]?.[0]?.places[0]?.likedBy).toEqual(['viewer-1']);
      expect(cache?.pages[0]?.[0]?.places[0]?.likes).toBe(1);
    });

    await act(async () => {
      resolveLike?.();
      await Promise.resolve();
    });
  });

  it('queues the explicit optimistic place-like state while offline', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    queryClient.setQueryData(queryKeys.feed.page('viewer-1'), {
      pageParams: [null],
      pages: [{
        items: [{
          key: 'list-1:place-1',
          listId: 'list-1',
          listIsPublic: true,
          listName: 'List',
          memberships: [],
          ownerId: 'owner-1',
          place: {
            addedAt: '2026-04-16T10:00:00.000Z',
            id: 'place-1',
            lat: 41,
            likes: 0,
            lng: 29,
            name: 'Cafe',
          },
          sortTime: 1,
        }],
      }],
    });
    onlineManager.setOnline(false);
    const hooks = await import('@/mobile/app/data/hooks/usePlaceMutations');
    const likeHook = renderHook(() => hooks.useToggleLikePlaceMutation(), { wrapper });

    await act(async () => {
      await likeHook.result.current.mutateAsync({ placeId: 'place-1', userId: 'viewer-1' });
    });

    expect(toggleLikePlaceMock).not.toHaveBeenCalled();
    expect(enqueueDurableOutboxEntryMock).toHaveBeenCalledWith({
      idempotencyKey: 'place-like-state:viewer-1:place-1',
      kind: 'place-like-state',
      payloadRef: { liked: true, placeId: 'place-1' },
      userId: 'viewer-1',
    });
  });

  it('queues transient place-like failures and rejects permanent failures', async () => {
    const queryClient = createTestQueryClient();
    const hooks = await import('@/mobile/app/data/hooks/usePlaceMutations');
    const input = { placeId: 'place-1', userId: 'viewer-1' };

    toggleLikePlaceMock.mockRejectedValueOnce(new TypeError('network'));
    await expect(
      hooks.placeMutationInternals.togglePlaceLikeOrQueue(queryClient, input),
    ).resolves.toBeUndefined();
    expect(enqueueDurableOutboxEntryMock).toHaveBeenCalledOnce();

    enqueueDurableOutboxEntryMock.mockClear();
    toggleLikePlaceMock.mockRejectedValueOnce({ status: 400 });
    await expect(
      hooks.placeMutationInternals.togglePlaceLikeOrQueue(queryClient, input),
    ).rejects.toEqual({ status: 400 });
    expect(enqueueDurableOutboxEntryMock).not.toHaveBeenCalled();
  });

  it('queues offline comments with explicit and implicit parent state', async () => {
    onlineManager.setOnline(false);
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const hooks = await import('@/mobile/app/data/hooks/usePlaceMutations');
    const mutation = renderHook(() => hooks.useCreatePlaceCommentMutation(), { wrapper });

    await act(async () => {
      await mutation.result.current.mutateAsync({
        commentId: 'root-comment',
        content: 'Root',
        placeId: 'place-1',
        userId: 'viewer-1',
      });
      await mutation.result.current.mutateAsync({
        commentId: 'reply-comment',
        content: 'Reply',
        parentCommentId: 'root-comment',
        placeId: 'place-1',
        userId: 'viewer-1',
      });
    });

    expect(createPlaceCommentMock).not.toHaveBeenCalled();
    expect(enqueueDurableOutboxEntryMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payloadRef: expect.objectContaining({ parentCommentId: null }),
      }),
    );
    expect(enqueueDurableOutboxEntryMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        payloadRef: expect.objectContaining({ parentCommentId: 'root-comment' }),
      }),
    );
  });

  it('reports places and comments without invalidating visible data', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const hooks = await import('@/mobile/app/data/hooks/usePlaceMutations');
    reportPlaceMock.mockResolvedValue(undefined);
    reportPlaceCommentMock.mockResolvedValue(undefined);

    const placeReportHook = renderHook(() => hooks.useReportPlaceMutation(), { wrapper });
    const commentReportHook = renderHook(() => hooks.useReportPlaceCommentMutation(), { wrapper });

    await act(async () => {
      await placeReportHook.result.current.mutateAsync({
        reporterUserId: 'viewer-1',
        placeId: 'place-1',
        reason: 'spam',
      });
      await commentReportHook.result.current.mutateAsync({
        commentId: 'comment-1',
        reporterUserId: 'viewer-1',
        reason: 'abuse',
      });
    });

    expect(reportPlaceMock).toHaveBeenCalledWith('viewer-1', 'place-1', 'spam', undefined);
    expect(reportPlaceCommentMock).toHaveBeenCalledWith('comment-1', 'viewer-1', 'abuse', undefined);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
