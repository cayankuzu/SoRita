import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock('@/mobile/app/platform/feedback/toast', () => ({ showToast: toast.show }));

import type { User } from '@/mobile/app/data/contracts/entities';
import { useExploreFollowToggle } from '@/mobile/app/features/explore/application/useExploreFollowToggle';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

const deniz = { id: 'deniz', isPublicAccount: false, name: 'Deniz', username: 'deniz' } as User;
const ada = { id: 'ada', name: 'Ada', username: 'ada' } as User;

describe('useExploreFollowToggle', () => {
  beforeEach(() => {
    toast.show.mockReset();
  });

  it('follows in one tap and says so', async () => {
    const followUser = vi.fn().mockResolvedValue('following');
    const hook = renderHook(() =>
      useExploreFollowToggle({ followUser, following: [], people: [ada] }),
    );

    await act(async () => {
      await hook.result.current.requestFollowToggle('ada');
    });
    expect(followUser).toHaveBeenCalledWith('ada');
    expect(toast.show).toHaveBeenCalledWith(tr.explore.toast.userFollowed, 'success');
  });

  it('asks before unfollowing someone the viewer follows, and can be called off', async () => {
    const followUser = vi.fn().mockResolvedValue('unfollowed');
    const hook = renderHook(() =>
      useExploreFollowToggle({ followUser, following: ['deniz'], people: [deniz] }),
    );

    await act(async () => {
      await hook.result.current.requestFollowToggle('deniz');
    });
    expect(followUser).not.toHaveBeenCalled();
    expect(hook.result.current.unfollowTarget).toEqual({ isPrivateAccount: true, username: 'deniz' });

    act(() => {
      hook.result.current.cancelUnfollow();
    });
    expect(hook.result.current.unfollowTarget).toBeNull();
    expect(followUser).not.toHaveBeenCalled();

    await act(async () => {
      await hook.result.current.requestFollowToggle('deniz');
    });
    await act(async () => {
      await hook.result.current.confirmUnfollow();
    });
    expect(followUser).toHaveBeenCalledWith('deniz');
    expect(hook.result.current.unfollowTarget).toBeNull();
  });

  it('reports a failed request', async () => {
    const followUser = vi.fn().mockRejectedValue(new Error('ağ yok'));
    const hook = renderHook(() =>
      useExploreFollowToggle({ followUser, following: [], people: [ada] }),
    );

    await act(async () => {
      await hook.result.current.requestFollowToggle('ada');
    });
    expect(toast.show).toHaveBeenCalledWith('ağ yok', 'error');
  });
});
