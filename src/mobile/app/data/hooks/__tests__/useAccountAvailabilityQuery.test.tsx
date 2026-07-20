import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';

const checkAccountAvailabilityMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/accountAvailability', () => ({
  checkAccountAvailability: checkAccountAvailabilityMock,
}));

describe('useAccountAvailabilityQuery', () => {
  beforeEach(() => {
    checkAccountAvailabilityMock.mockReset();
  });

  it('returns idle for an empty username', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const hooks = await import('@/mobile/app/data/hooks/useAccountAvailabilityQuery');

    const hook = renderHook(
      () =>
        hooks.useUsernameAvailabilityQuery({
          active: true,
          value: '   ',
          availableMessage: 'ok',
          checkingMessage: 'checking',
          errorMessage: 'error',
          unavailableMessage: 'taken',
        }),
      { wrapper },
    );

    expect(hook.result.current.availability).toEqual({ status: 'idle' });
    expect(checkAccountAvailabilityMock).not.toHaveBeenCalled();
  });

  it('returns invalid for a username that fails client validation', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const hooks = await import('@/mobile/app/data/hooks/useAccountAvailabilityQuery');

    const hook = renderHook(
      () =>
        hooks.useUsernameAvailabilityQuery({
          active: true,
          value: 'ab',
          availableMessage: 'ok',
          checkingMessage: 'checking',
          errorMessage: 'error',
          unavailableMessage: 'taken',
          invalidMessage: (value) => (value.length < 3 ? 'too short' : null),
        }),
      { wrapper },
    );

    expect(hook.result.current.availability).toEqual({
      status: 'invalid',
      message: 'too short',
    });
    expect(checkAccountAvailabilityMock).not.toHaveBeenCalled();
  });

  it('returns available for a successful username check', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    checkAccountAvailabilityMock.mockResolvedValue({
      emailAvailable: true,
      usernameAvailable: true,
    });
    const hooks = await import('@/mobile/app/data/hooks/useAccountAvailabilityQuery');

    const hook = renderHook(
      () =>
        hooks.useUsernameAvailabilityQuery({
          active: true,
          value: 'NewUser',
          availableMessage: 'available',
          checkingMessage: 'checking',
          errorMessage: 'error',
          unavailableMessage: 'taken',
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(hook.result.current.availability).toEqual({
        status: 'available',
        message: 'available',
      });
    });
    expect(checkAccountAvailabilityMock).toHaveBeenCalledWith({
      username: 'newuser',
      excludeUserId: undefined,
    });
  });

  it('returns unavailable for a successful email check', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    checkAccountAvailabilityMock.mockResolvedValue({
      emailAvailable: false,
      usernameAvailable: true,
    });
    const hooks = await import('@/mobile/app/data/hooks/useAccountAvailabilityQuery');

    const hook = renderHook(
      () =>
        hooks.useEmailAvailabilityQuery({
          active: true,
          value: 'test@example.com',
          availableMessage: 'available',
          checkingMessage: 'checking',
          errorMessage: 'error',
          unavailableMessage: 'taken',
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(hook.result.current.availability).toEqual({
        status: 'unavailable',
        message: 'taken',
      });
    });
  });

  it('returns error when the query fails', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    checkAccountAvailabilityMock.mockRejectedValue(new Error('boom'));
    const hooks = await import('@/mobile/app/data/hooks/useAccountAvailabilityQuery');

    const hook = renderHook(
      () =>
        hooks.useEmailAvailabilityQuery({
          active: true,
          value: 'test@example.com',
          availableMessage: 'available',
          checkingMessage: 'checking',
          errorMessage: 'error',
          unavailableMessage: 'taken',
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(hook.result.current.availability).toEqual({
        status: 'error',
        message: 'error',
      });
    });
  });
});
