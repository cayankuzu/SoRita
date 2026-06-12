import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const updateUserMock = vi.fn();
const blockUserMock = vi.fn();
const unblockUserMock = vi.fn();
const reportUserMock = vi.fn();
const deleteCurrentUserMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/usersRepository', () => ({
  blockUser: blockUserMock,
  deleteCurrentUser: deleteCurrentUserMock,
  followUser: vi.fn(),
  reportUser: reportUserMock,
  unblockUser: unblockUserMock,
  updateUser: updateUserMock,
}));

describe('useUserMutations extra coverage', () => {
  beforeEach(() => {
    updateUserMock.mockReset();
    blockUserMock.mockReset();
    unblockUserMock.mockReset();
    reportUserMock.mockReset();
    deleteCurrentUserMock.mockReset();
  });

  it('invalidates visible data for update/block/unblock and clears cache on delete', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const clearSpy = vi.spyOn(queryClient, 'clear');
    const hooks = await import('@/mobile/app/data/hooks/useUserMutations');

    updateUserMock.mockResolvedValue(undefined);
    blockUserMock.mockResolvedValue(undefined);
    unblockUserMock.mockResolvedValue(undefined);
    deleteCurrentUserMock.mockResolvedValue(undefined);
    reportUserMock.mockResolvedValue(undefined);

    const updateHook = renderHook(() => hooks.useUpdateUserMutation(), { wrapper });
    const blockHook = renderHook(() => hooks.useBlockUserMutation(), { wrapper });
    const unblockHook = renderHook(() => hooks.useUnblockUserMutation(), { wrapper });
    const reportHook = renderHook(() => hooks.useReportUserMutation(), { wrapper });
    const deleteHook = renderHook(() => hooks.useDeleteCurrentUserMutation(), { wrapper });

    await act(async () => {
      await updateHook.result.current.mutateAsync({
        id: 'viewer',
        email: 'viewer@example.com',
        name: 'Viewer',
        username: 'viewer',
      });
      await blockHook.result.current.mutateAsync({
        currentUserId: 'viewer',
        targetUserId: 'target',
      });
      await unblockHook.result.current.mutateAsync({
        currentUserId: 'viewer',
        targetUserId: 'target',
      });
      await reportHook.result.current.mutateAsync({
        reporterUserId: 'viewer',
        targetUserId: 'target',
        reason: 'spam',
      });
      await deleteHook.result.current.mutateAsync();
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.visibleData.all,
      });
    });
    expect(clearSpy).toHaveBeenCalled();
    expect(reportUserMock).toHaveBeenCalledWith('viewer', 'target', 'spam');
  });
});
