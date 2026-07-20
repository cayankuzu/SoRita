import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const {
  connectionStatusMock,
  createListMock,
  deleteListMock,
  enqueueDurableOutboxEntryMock,
  reportListMock,
  updateListMock,
  updateListsMock,
} = vi.hoisted(() => ({
  connectionStatusMock: vi.fn(),
  createListMock: vi.fn(),
  deleteListMock: vi.fn(),
  enqueueDurableOutboxEntryMock: vi.fn(),
  reportListMock: vi.fn(),
  updateListMock: vi.fn(),
  updateListsMock: vi.fn(),
}));

vi.mock('@/mobile/app/data/repositories/listsRepository', () => ({
  createList: createListMock,
  updateList: updateListMock,
  updateLists: updateListsMock,
  deleteList: deleteListMock,
  reportList: reportListMock,
}));

vi.mock('@/mobile/app/data/outbox/enqueueDurableOutboxEntry', () => ({
  enqueueDurableOutboxEntry: enqueueDurableOutboxEntryMock,
}));

vi.mock('@/mobile/app/platform/network/connectivityStatus', () => ({
  getCurrentConnectionStatus: connectionStatusMock,
}));

describe('useListMutations', () => {
  beforeEach(() => {
    createListMock.mockReset();
    updateListMock.mockReset();
    updateListsMock.mockReset();
    deleteListMock.mockReset();
    enqueueDurableOutboxEntryMock.mockReset();
    reportListMock.mockReset();
    connectionStatusMock.mockReset();
    connectionStatusMock.mockReturnValue('online');
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
    expect(updateListMock).toHaveBeenCalledWith(list, undefined);
  });

  it('forwards the existing list snapshot without another repository lookup', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const hooks = await import('@/mobile/app/data/hooks/useListMutations');
    const previousList = {
      id: 'list-1', userId: 'viewer-1', name: 'Before', places: [], isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const list = { ...previousList, name: 'After' };
    updateListMock.mockResolvedValue(undefined);
    const updateHook = renderHook(() => hooks.useUpdateListMutation(), { wrapper });

    await act(async () => {
      await updateHook.result.current.mutateAsync({ list, previousList });
    });

    expect(updateListMock).toHaveBeenCalledWith(list, previousList);
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

    expect(reportListMock).toHaveBeenCalledWith('viewer-1', 'list-1', 'spam', undefined);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('queues retryable list saves and preserves progress inputs', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const hooks = await import('@/mobile/app/data/hooks/useListMutations');
    const list = {
      id: 'list-2', userId: 'viewer-1', name: 'Saved', places: [], isPublic: false,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const onProgress = vi.fn();
    const abortSignal = new AbortController().signal;
    updateListsMock.mockRejectedValueOnce(new TypeError('network failed'));
    enqueueDurableOutboxEntryMock.mockResolvedValue(undefined);
    const updateManyHook = renderHook(() => hooks.useUpdateListsMutation(), { wrapper });

    await act(async () => {
      await updateManyHook.result.current.mutateAsync({ lists: [list], onProgress, abortSignal });
    });

    expect(updateListsMock).toHaveBeenCalledWith([list], onProgress, abortSignal, undefined);
    expect(enqueueDurableOutboxEntryMock).toHaveBeenCalledWith({
      idempotencyKey: 'lists-update:list-2',
      kind: 'lists-update',
      payloadRef: { lists: [list] },
      userId: 'viewer-1',
    });
  });

  it('does not queue aborts, invalid owners, or permanent online errors', async () => {
    const { listMutationInternals } = await import('@/mobile/app/data/hooks/useListMutations');
    const abortError = new Error('cancelled');
    abortError.name = 'AbortError';

    expect(listMutationInternals.readMutationStatus(null)).toBeUndefined();
    expect(listMutationInternals.readMutationStatus('failure')).toBeUndefined();
    expect(listMutationInternals.readMutationStatus({ status: 'bad' })).toBeUndefined();
    expect(listMutationInternals.readMutationStatus({ status: 503 })).toBe(503);
    expect(listMutationInternals.shouldQueueListsUpdate(abortError)).toBe(false);
    expect(listMutationInternals.shouldQueueListsUpdate({ status: 400 })).toBe(false);

    updateListsMock.mockRejectedValueOnce({ status: 400 });
    await expect(listMutationInternals.updateListsOrQueue({
      lists: [{ id: 'missing-owner' } as never],
    })).rejects.toEqual({ status: 400 });
    expect(enqueueDurableOutboxEntryMock).not.toHaveBeenCalled();
  });

  it('recognizes offline, rate-limit, and server failures as durable retries', async () => {
    const { listMutationInternals } = await import('@/mobile/app/data/hooks/useListMutations');

    connectionStatusMock.mockReturnValue('offline');
    expect(listMutationInternals.shouldQueueListsUpdate(new Error('offline'))).toBe(true);
    connectionStatusMock.mockReturnValue('online');
    expect(listMutationInternals.shouldQueueListsUpdate(new TypeError('transport'))).toBe(true);
    expect(listMutationInternals.shouldQueueListsUpdate({ status: 429 })).toBe(true);
    expect(listMutationInternals.shouldQueueListsUpdate({ status: 500 })).toBe(true);
    expect(listMutationInternals.normalizeUpdateListsMutationInput([])).toEqual({ lists: [] });
    const objectInput = { lists: [], onProgress: vi.fn() };
    expect(listMutationInternals.normalizeUpdateListsMutationInput(objectInput)).toBe(objectInput);
  });
});
