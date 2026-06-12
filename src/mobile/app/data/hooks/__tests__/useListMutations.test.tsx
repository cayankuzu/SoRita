import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const createListMock = vi.fn();
const updateListMock = vi.fn();
const updateListsMock = vi.fn();
const deleteListMock = vi.fn();
const reportListMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/listsRepository', () => ({
  createList: createListMock,
  updateList: updateListMock,
  updateLists: updateListsMock,
  deleteList: deleteListMock,
  reportList: reportListMock,
}));

describe('useListMutations', () => {
  beforeEach(() => {
    createListMock.mockReset();
    updateListMock.mockReset();
    updateListsMock.mockReset();
    deleteListMock.mockReset();
    reportListMock.mockReset();
  });

  it('invalidates visible data for create/update/delete mutations', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const hooks = await import('@/mobile/app/data/hooks/useListMutations');
    const list = {
      id: 'list-1',
      userId: 'viewer-1',
      name: 'Favorites',
      places: [],
      isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    createListMock.mockResolvedValue(undefined);
    updateListMock.mockResolvedValue(undefined);
    updateListsMock.mockResolvedValue(undefined);
    deleteListMock.mockResolvedValue(undefined);

    const createHook = renderHook(() => hooks.useCreateListMutation(), { wrapper });
    const updateHook = renderHook(() => hooks.useUpdateListMutation(), { wrapper });
    const updateManyHook = renderHook(() => hooks.useUpdateListsMutation(), { wrapper });
    const deleteHook = renderHook(() => hooks.useDeleteListMutation(), { wrapper });

    await act(async () => {
      await createHook.result.current.mutateAsync(list);
      await updateHook.result.current.mutateAsync(list);
      await updateManyHook.result.current.mutateAsync([list]);
      await deleteHook.result.current.mutateAsync(list.id);
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.visibleData.all,
      });
    });
  });

  it('reports lists without invalidating visible data', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    reportListMock.mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/data/hooks/useListMutations');
    const reportHook = renderHook(() => hooks.useReportListMutation(), { wrapper });

    await act(async () => {
      await reportHook.result.current.mutateAsync({
        reporterUserId: 'viewer-1',
        listId: 'list-1',
        reason: 'spam',
      });
    });

    expect(reportListMock).toHaveBeenCalledWith('viewer-1', 'list-1', 'spam');
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
