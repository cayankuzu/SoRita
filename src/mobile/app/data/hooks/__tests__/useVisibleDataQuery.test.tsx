import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const fetchVisibleDataContextMock = vi.fn();
const fetchVisibleListsPageMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/visibleDataRepository', () => ({
  fetchVisibleDataContext: fetchVisibleDataContextMock,
  fetchVisibleListsPage: fetchVisibleListsPageMock,
}));

describe('useVisibleDataQuery', () => {
  beforeEach(() => {
    fetchVisibleDataContextMock.mockReset();
    fetchVisibleListsPageMock.mockReset();
  });

  it('loads a snapshot and keeps the result in the query cache', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const snapshot = {
      allUsers: [],
      blockRows: [],
      currentUser: null,
      lists: [],
      users: [],
    };

    fetchVisibleDataContextMock.mockResolvedValue({
      allUsers: [],
      blockRows: [],
      currentUser: null,
      users: [],
    });
    fetchVisibleListsPageMock.mockResolvedValue([]);
    const hooks = await import('@/mobile/app/data/hooks/useVisibleDataQuery');
    const hook = renderHook(() => hooks.useVisibleDataQuery('viewer-1'), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.data).toEqual(snapshot);
    });

    expect(fetchVisibleDataContextMock).toHaveBeenCalledWith('viewer-1');
    expect(fetchVisibleListsPageMock).toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.visibleData.snapshot('viewer-1'))).toEqual(snapshot);
  });

  it('uses the public viewer cache key when no user id is provided', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const snapshot = {
      allUsers: [],
      blockRows: [],
      currentUser: null,
      lists: [],
      users: [],
    };

    fetchVisibleDataContextMock.mockResolvedValue({
      allUsers: [],
      blockRows: [],
      currentUser: null,
      users: [],
    });
    fetchVisibleListsPageMock.mockResolvedValue([]);
    const hooks = await import('@/mobile/app/data/hooks/useVisibleDataQuery');
    const hook = renderHook(() => hooks.useVisibleDataQuery(undefined), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.data).toEqual(snapshot);
    });

    expect(fetchVisibleDataContextMock).toHaveBeenCalledWith(undefined);
    expect(queryClient.getQueryData(queryKeys.visibleData.snapshot('__public__'))).toEqual(snapshot);
  });

  it('can skip list pagination and refetch context-only state', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    fetchVisibleDataContextMock.mockResolvedValue({
      allUsers: [{ id: 'viewer-1' }],
      blockRows: [],
      currentUser: { id: 'viewer-1' },
      users: [{ id: 'viewer-1' }],
    });

    const hooks = await import('@/mobile/app/data/hooks/useVisibleDataQuery');
    const hook = renderHook(
      () => hooks.useVisibleDataQuery('viewer-1', { includeLists: false }),
      { wrapper },
    );

    await waitFor(() => {
      expect(hook.result.current.data).toEqual({
        allUsers: [{ id: 'viewer-1' }],
        blockRows: [],
        currentUser: { id: 'viewer-1' },
        lists: [],
        users: [{ id: 'viewer-1' }],
      });
    });

    expect(fetchVisibleListsPageMock).not.toHaveBeenCalled();
    expect(hook.result.current.fetchNextPage).toBeUndefined();
    await expect(hook.result.current.refetch()).resolves.toEqual({
      data: {
        allUsers: [{ id: 'viewer-1' }],
        blockRows: [],
        currentUser: { id: 'viewer-1' },
        lists: [],
        users: [{ id: 'viewer-1' }],
      },
      error: null,
    });
  });

  it('deduplicates paginated lists and stops pagination for listId queries', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    fetchVisibleDataContextMock.mockResolvedValue({
      allUsers: [],
      blockRows: [],
      currentUser: null,
      users: [],
    });
    fetchVisibleListsPageMock
      .mockResolvedValueOnce([{ id: 'list-1' }])
      .mockResolvedValueOnce([{ id: 'list-1' }, { id: 'list-2' }]);

    const hooks = await import('@/mobile/app/data/hooks/useVisibleDataQuery');
    const hook = renderHook(
      () => hooks.useVisibleDataQuery('viewer-1', { listPageSize: 1 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(hook.result.current.data?.lists).toEqual([{ id: 'list-1' }]);
    });

    await hook.result.current.fetchNextPage?.();

    await waitFor(() => {
      expect(hook.result.current.data?.lists).toEqual([{ id: 'list-1' }, { id: 'list-2' }]);
    });

    fetchVisibleListsPageMock.mockReset();
    fetchVisibleDataContextMock.mockResolvedValue({
      allUsers: [],
      blockRows: [],
      currentUser: null,
      users: [],
    });
    fetchVisibleListsPageMock.mockResolvedValue([{ id: 'list-99' }]);

    const listHook = renderHook(
      () => hooks.useVisibleDataQuery('viewer-1', { listId: 'list-99' }),
      { wrapper: createQueryClientWrapper(createTestQueryClient()) },
    );

    await waitFor(() => {
      expect(listHook.result.current.hasNextPage).toBe(false);
      expect(listHook.result.current.data?.lists).toEqual([{ id: 'list-99' }]);
    });
  });

  it('keeps context data available when list pagination fails and exposes a partial-data error', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);

    fetchVisibleDataContextMock.mockResolvedValue({
      allUsers: [{ id: 'viewer-1' }],
      blockRows: [],
      currentUser: { id: 'viewer-1' },
      users: [{ id: 'viewer-1' }],
    });
    fetchVisibleListsPageMock.mockRejectedValue(new Error('Network request failed'));

    const hooks = await import('@/mobile/app/data/hooks/useVisibleDataQuery');
    const hook = renderHook(() => hooks.useVisibleDataQuery('viewer-1'), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.data).toEqual({
        allUsers: [{ id: 'viewer-1' }],
        blockRows: [],
        currentUser: { id: 'viewer-1' },
        lists: [],
        users: [{ id: 'viewer-1' }],
      });
      expect(hook.result.current.error).toBeInstanceOf(Error);
      expect(hook.result.current.hasPartialDataError).toBe(true);
    });
  });

  it('keeps filtered snapshot data instant and merges fresh list results after a manual refetch', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const existingSnapshot = {
      allUsers: [],
      blockRows: [],
      currentUser: null,
      lists: [
        {
          id: 'list-1',
          createdAt: '2026-06-15T10:00:00.000Z',
          isPublic: true,
          name: 'One',
          places: [],
          updatedAt: '2026-06-15T10:00:00.000Z',
          userId: 'user-1',
        },
        {
          id: 'list-2',
          createdAt: '2026-06-15T11:00:00.000Z',
          isPublic: true,
          name: 'Old two',
          places: [],
          updatedAt: '2026-06-15T11:00:00.000Z',
          userId: 'user-1',
        },
      ],
      users: [],
    };

    queryClient.setQueryData(queryKeys.visibleData.snapshot('viewer-1'), existingSnapshot);
    fetchVisibleDataContextMock.mockResolvedValue({
      allUsers: [],
      blockRows: [],
      currentUser: null,
      users: [],
    });
    fetchVisibleListsPageMock.mockResolvedValue([
      {
        id: 'list-2',
        createdAt: '2026-06-15T12:00:00.000Z',
        isPublic: true,
        name: 'Fresh two',
        places: [],
        updatedAt: '2026-06-15T12:00:00.000Z',
        userId: 'user-1',
      },
    ]);

    const hooks = await import('@/mobile/app/data/hooks/useVisibleDataQuery');
    const hook = renderHook(
      () => hooks.useVisibleDataQuery('viewer-1', { listId: 'list-2' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(hook.result.current.data?.lists[0]?.id).toBe('list-2');
    });

    expect(fetchVisibleDataContextMock).not.toHaveBeenCalled();
    expect(fetchVisibleListsPageMock).not.toHaveBeenCalled();

    await hook.result.current.refetch();

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.visibleData.snapshot('viewer-1'))).toEqual({
        ...existingSnapshot,
        lists: [
          {
            id: 'list-2',
            createdAt: '2026-06-15T12:00:00.000Z',
            isPublic: true,
            name: 'Fresh two',
            places: [],
            updatedAt: '2026-06-15T12:00:00.000Z',
            userId: 'user-1',
          },
          {
            id: 'list-1',
            createdAt: '2026-06-15T10:00:00.000Z',
            isPublic: true,
            name: 'One',
            places: [],
            updatedAt: '2026-06-15T10:00:00.000Z',
            userId: 'user-1',
          },
        ],
      });
    });
  });
});
