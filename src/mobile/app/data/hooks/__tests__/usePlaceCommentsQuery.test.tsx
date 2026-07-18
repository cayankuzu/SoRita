import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '@/mobile/app/test/queryTestUtils';

const getPlaceCommentsPageMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/placesRepository', () => ({
  getPlaceCommentsPage: getPlaceCommentsPageMock,
}));

describe('usePlaceCommentsQuery', () => {
  beforeEach(() => {
    getPlaceCommentsPageMock.mockReset();
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

    getPlaceCommentsPageMock
      .mockResolvedValueOnce(fullPage)
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
      expect(getPlaceCommentsPageMock).toHaveBeenNthCalledWith(1, 'place-1', 0, 20);
      expect(getPlaceCommentsPageMock).toHaveBeenNthCalledWith(2, 'place-1', 20, 20);
      expect(hook.result.current.hasNextPage).toBe(false);
    });
  });

  it('stays disabled without a place id', async () => {
    const wrapper = createQueryClientWrapper(createTestQueryClient());
    const { usePlaceCommentsQuery } = await import('@/mobile/app/data/hooks/usePlaceCommentsQuery');
    const hook = renderHook(() => usePlaceCommentsQuery(undefined, 'viewer-1'), { wrapper });

    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.isFetching).toBe(false);
    expect(getPlaceCommentsPageMock).not.toHaveBeenCalled();
  });
});
