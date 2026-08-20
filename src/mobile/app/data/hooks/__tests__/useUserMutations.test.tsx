import { onlineManager } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const followUserMock = vi.fn();
const enqueueDurableOutboxEntryMock = vi.fn();

vi.mock('@/mobile/app/data/outbox/enqueueDurableOutboxEntry', () => ({
  enqueueDurableOutboxEntry: enqueueDurableOutboxEntryMock,
}));

vi.mock('@/mobile/app/data/repositories/usersRepository', () => ({
  blockUser: vi.fn(),
  deleteCurrentUser: vi.fn(),
  followUser: followUserMock,
  reportUser: vi.fn(),
  unblockUser: vi.fn(),
  updateUser: vi.fn(),
}));

describe('useFollowUserMutation', () => {
  beforeEach(() => {
    followUserMock.mockReset();
    enqueueDurableOutboxEntryMock.mockReset();
    enqueueDurableOutboxEntryMock.mockResolvedValue(undefined);
    onlineManager.setOnline(true);
  });

  it('invalidates visible data on success', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    followUserMock.mockResolvedValue('following');
    const hooks = await import('@/mobile/app/data/hooks/useUserMutations');
    const mutationHook = renderHook(() => hooks.useFollowUserMutation(), {
      wrapper,
    });

    await act(async () => {
      await mutationHook.result.current.mutateAsync({
        currentUserId: 'viewer-1',
        targetUserId: 'target-1',
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.visibleData.all,
      });
    });
  });

  it('optimistically reflects follow state while the request is pending', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const contextQueryKey = queryKeys.visibleData.context('viewer-1');
    let resolveFollow: ((value: 'following') => void) | undefined;

    queryClient.setQueryData(contextQueryKey, {
      allUsers: [
        {
          id: 'viewer-1',
          email: 'viewer@example.com',
          name: 'Viewer',
          username: 'viewer',
        },
        {
          id: 'target-1',
          email: 'target@example.com',
          name: 'Target',
          username: 'target',
          isPublicAccount: true,
        },
      ],
      blockRows: [],
      currentUser: {
        id: 'viewer-1',
        email: 'viewer@example.com',
        name: 'Viewer',
        username: 'viewer',
      },
      users: [
        {
          id: 'viewer-1',
          email: 'viewer@example.com',
          name: 'Viewer',
          username: 'viewer',
        },
        {
          id: 'target-1',
          email: 'target@example.com',
          name: 'Target',
          username: 'target',
          isPublicAccount: true,
        },
      ],
    });
    followUserMock.mockReturnValue(
      new Promise<'following'>((resolve) => {
        resolveFollow = resolve;
      }),
    );
    const hooks = await import('@/mobile/app/data/hooks/useUserMutations');
    const mutationHook = renderHook(() => hooks.useFollowUserMutation(), {
      wrapper,
    });

    act(() => {
      mutationHook.result.current.mutate({
        currentUserId: 'viewer-1',
        targetUserId: 'target-1',
      });
    });

    await waitFor(() => {
      const cache = queryClient.getQueryData<{
        currentUser: { following?: string[] };
        users: Array<{ id: string; followers?: string[] }>;
      }>(contextQueryKey);
      expect(cache?.currentUser.following).toEqual(['target-1']);
      expect(cache?.users.find((item) => item.id === 'target-1')?.followers).toEqual([
        'viewer-1',
      ]);
    });

    await act(async () => {
      resolveFollow?.('following');
      await Promise.resolve();
    });
  });

  it('keeps the optimistic follow state and queues it while offline', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    queryClient.setQueryData(queryKeys.visibleData.context('viewer-1'), {
      allUsers: [
        { id: 'viewer-1', name: 'Viewer', username: 'viewer' },
        { id: 'target-1', isPublicAccount: true, name: 'Target', username: 'target' },
      ],
      blockRows: [],
      currentUser: { id: 'viewer-1', name: 'Viewer', username: 'viewer' },
      lists: [],
      users: [],
    });
    onlineManager.setOnline(false);
    const hooks = await import('@/mobile/app/data/hooks/useUserMutations');
    const mutationHook = renderHook(() => hooks.useFollowUserMutation(), { wrapper });

    await act(async () => {
      await mutationHook.result.current.mutateAsync({
        currentUserId: 'viewer-1',
        targetUserId: 'target-1',
      });
    });

    expect(followUserMock).not.toHaveBeenCalled();
    expect(enqueueDurableOutboxEntryMock).toHaveBeenCalledWith({
      idempotencyKey: 'user-follow-state:viewer-1:target-1',
      kind: 'user-follow-state',
      payloadRef: { desiredState: 'following', targetUserId: 'target-1' },
      userId: 'viewer-1',
    });
  });

  it('queues transient follow failures and rejects permanent failures', async () => {
    const queryClient = createTestQueryClient();
    const hooks = await import('@/mobile/app/data/hooks/useUserMutations');
    const input = { currentUserId: 'viewer-1', targetUserId: 'target-1' };

    followUserMock.mockRejectedValueOnce(new TypeError('network'));
    await expect(
      hooks.userMutationInternals.followUserOrQueue(queryClient, input),
    ).resolves.toBe('following');
    expect(enqueueDurableOutboxEntryMock).toHaveBeenCalledOnce();

    enqueueDurableOutboxEntryMock.mockClear();
    followUserMock.mockRejectedValueOnce({ status: 400 });
    await expect(
      hooks.userMutationInternals.followUserOrQueue(queryClient, input),
    ).rejects.toEqual({ status: 400 });
    expect(enqueueDurableOutboxEntryMock).not.toHaveBeenCalled();
  });
});
