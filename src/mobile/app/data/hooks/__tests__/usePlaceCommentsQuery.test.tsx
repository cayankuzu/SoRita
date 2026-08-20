import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '@/mobile/app/test/queryTestUtils';

const getPlaceCommentThreadsPageMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/placesRepository', () => ({
  getPlaceCommentThreadsPage: getPlaceCommentThreadsPageMock,
}));

describe('usePlaceCommentsQuery', () => {
  beforeEach(() => {
    getPlaceCommentThreadsPageMock.mockReset();
  });

  it('loads paginated comment pages and advances the offset by top-level comments', async () => {
    const fullPage = Array.from({ length: 20 }, (_, index) => ({
      id: `comment-${index}`,
      list_place_id: 'place-1',
      user_id: `user-${index}`,
      parent_comment_id: null,
      content: `comment ${index}`,
      created_at: '2026-04-16T10:00:00.000Z',
      updated_at: '2026-04-16T10:00:00.000Z',
      list_place_comment_likes: [],
    }));

    const nextCursor = {
      createdAt: '2026-04-16T10:00:00.000Z',
      id: 'comment-19',
    };
    getPlaceCommentThreadsPageMock
      .mockResolvedValueOnce(Object.assign(fullPage, { nextCursor }))
      .mockResolvedValueOnce([]);

    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const { usePlaceCommentsQuery } = await import('@/mobile/app/data/hooks/usePlaceCommentsQuery');
    const hook = renderHook(() => usePlaceCommentsQuery('place-1', 'viewer-1'), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.data?.pages).toHaveLength(1);
      expect(hook.result.current.hasNextPage).toBe(true);
    });

    await hook.result.current.fetchNextPage();

    await waitFor(() => {
      expect(getPlaceCommentThreadsPageMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          cursor: null,
          pageSize: 20,
          placeId: 'place-1',
          viewerId: 'viewer-1',
        }),
      );
      expect(getPlaceCommentThreadsPageMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          cursor: nextCursor,
          pageSize: 20,
          placeId: 'place-1',
          viewerId: 'viewer-1',
        }),
      );
      expect(hook.result.current.hasNextPage).toBe(false);
    });
  });

  it('stays disabled without a place id', async () => {
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const { usePlaceCommentsQuery } = await import('@/mobile/app/data/hooks/usePlaceCommentsQuery');
    const hook = renderHook(() => usePlaceCommentsQuery(undefined, 'viewer-1'), { wrapper });

    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.isFetching).toBe(false);
    expect(getPlaceCommentThreadsPageMock).not.toHaveBeenCalled();
  });

  it('uses the public cache identity when a viewer is absent', async () => {
    getPlaceCommentThreadsPageMock.mockResolvedValue(
      Object.assign([], { nextCursor: undefined }),
    );
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const { usePlaceCommentsQuery } = await import('@/mobile/app/data/hooks/usePlaceCommentsQuery');
    const hook = renderHook(() => usePlaceCommentsQuery('place-1'), { wrapper });

    await waitFor(() => expect(hook.result.current.isFetching).toBe(false));
    expect(getPlaceCommentThreadsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ placeId: 'place-1', viewerId: undefined }),
    );
  });
});
