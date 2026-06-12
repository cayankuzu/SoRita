import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, AppState } from 'react-native';

import { renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const clearCurrentUserStateMock = vi.fn();
const getActiveOrPersistedSessionMock = vi.fn();
const getVerifiedAuthUserMock = vi.fn();
const isMissingAuthenticatedAccountErrorMock = vi.fn();
const getPersistedAuthUserSnapshotMock = vi.fn();
const persistAuthSessionMock = vi.fn();
const persistResolvedAuthUserMock = vi.fn();
const resolveImmediateAuthUserMock = vi.fn();
const syncAuthenticatedUserMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const signOutMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock('@/mobile/app/app-shell/auth/session/authSessionSupport', () => ({
  clearCurrentUserState: clearCurrentUserStateMock,
  getActiveOrPersistedSession: getActiveOrPersistedSessionMock,
  getVerifiedAuthUser: getVerifiedAuthUserMock,
  isMissingAuthenticatedAccountError: isMissingAuthenticatedAccountErrorMock,
  getPersistedAuthUserSnapshot: getPersistedAuthUserSnapshotMock,
  persistAuthSession: persistAuthSessionMock,
  persistResolvedAuthUser: persistResolvedAuthUserMock,
  resolveImmediateAuthUser: resolveImmediateAuthUserMock,
  syncAuthenticatedUser: syncAuthenticatedUserMock,
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
    },
  },
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}));

describe('useAuthSessionLifecycle', () => {
  beforeEach(() => {
    clearCurrentUserStateMock.mockReset();
    getActiveOrPersistedSessionMock.mockReset();
    getVerifiedAuthUserMock.mockReset();
    isMissingAuthenticatedAccountErrorMock.mockReset();
    getPersistedAuthUserSnapshotMock.mockReset();
    persistAuthSessionMock.mockReset();
    persistResolvedAuthUserMock.mockReset();
    resolveImmediateAuthUserMock.mockReset();
    syncAuthenticatedUserMock.mockReset();
    onAuthStateChangeMock.mockReset();
    signOutMock.mockReset();
    loggerErrorMock.mockReset();
    loggerWarnMock.mockReset();
    signOutMock.mockResolvedValue(undefined);

    vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    vi.spyOn(AppState, 'addEventListener').mockImplementation(() => ({
      remove: vi.fn(),
    }));
    isMissingAuthenticatedAccountErrorMock.mockReturnValue(false);
  });

  it('bootstraps persisted auth state and reacts to auth changes', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const immediateUser = { id: 'user-1', email: 'user@example.com', name: 'Ada', username: 'ada' };
    const syncedUser = { ...immediateUser, bio: 'synced' };
    let authChangeHandler: ((event: string, session: { user: typeof authUser } | null) => void) | null = null;

    getActiveOrPersistedSessionMock.mockResolvedValue({ user: authUser });
    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    resolveImmediateAuthUserMock.mockReturnValue(immediateUser);
    syncAuthenticatedUserMock.mockResolvedValue(syncedUser);
    onAuthStateChangeMock.mockImplementation((callback) => {
      authChangeHandler = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    renderHook(() =>
      hooks.useAuthSessionLifecycle({
        setBooted,
        setUser,
      }),
    );

    await authChangeHandler?.('INITIAL_SESSION', null);

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith(immediateUser);
      expect(setBooted).toHaveBeenCalledWith(true);
    });

    expect(persistAuthSessionMock).not.toHaveBeenCalledWith(null);

    await authChangeHandler?.('SIGNED_IN', { user: authUser });
    await waitFor(() => {
      expect(persistAuthSessionMock).toHaveBeenCalled();
      expect(syncAuthenticatedUserMock).toHaveBeenCalledWith(authUser);
    });
  });

  it('handles empty sessions, auth sync failures, and unmount cleanup', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const unsubscribeMock = vi.fn();
    let authChangeHandler: ((event: string, session: { user: { id: string; email: string } } | null) => void) | null = null;

    getActiveOrPersistedSessionMock.mockResolvedValueOnce(null);
    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    clearCurrentUserStateMock.mockImplementation(() => undefined);
    getVerifiedAuthUserMock.mockResolvedValue({ id: 'user-2', email: 'user2@example.com' });
    syncAuthenticatedUserMock.mockRejectedValueOnce(new Error('sync failed'));
    onAuthStateChangeMock.mockImplementation((callback) => {
      authChangeHandler = callback;
      return { data: { subscription: { unsubscribe: unsubscribeMock } } };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() =>
      hooks.useAuthSessionLifecycle({
        setBooted,
        setUser,
      }),
    );

    await waitFor(() => {
      expect(clearCurrentUserStateMock).toHaveBeenCalled();
      expect(setUser).toHaveBeenCalledWith(null);
      expect(setBooted).toHaveBeenCalledWith(true);
    });

    await authChangeHandler?.('SIGNED_OUT', null);
    await waitFor(() => {
      expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    });

    getActiveOrPersistedSessionMock.mockResolvedValue({
      user: { id: 'user-2', email: 'user2@example.com' },
    });
    resolveImmediateAuthUserMock.mockReturnValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User 2',
      username: 'user2',
    });
    syncAuthenticatedUserMock.mockRejectedValueOnce(new Error('sync failed again'));

    await authChangeHandler?.('SIGNED_IN', {
      user: { id: 'user-2', email: 'user2@example.com' },
    });
    await waitFor(() => {
      expect(loggerWarnMock).toHaveBeenCalledWith('auth', 'Failed to sync auth state', expect.any(Error));
    });

    hook.unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('alerts and signs the user out when the authenticated account is missing', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const missingAccountError = new Error('missing account');
    let authChangeHandler: ((event: string, session: { user: typeof authUser } | null) => void) | null = null;
    let appStateHandler: ((state: string) => void) | null = null;

    getActiveOrPersistedSessionMock.mockResolvedValue({ user: authUser });
    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getVerifiedAuthUserMock.mockRejectedValue(missingAccountError);
    isMissingAuthenticatedAccountErrorMock.mockImplementation((error) => error === missingAccountError);
    resolveImmediateAuthUserMock.mockReturnValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Ada',
      username: 'ada',
    });
    onAuthStateChangeMock.mockImplementation((callback) => {
      authChangeHandler = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    renderHook(() =>
      hooks.useAuthSessionLifecycle({
        setBooted,
        setUser,
      }),
    );

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Hesap silindi',
        'Bu hesap artik mevcut olmadigi icin oturumun kapatildi.',
      );
      expect(setUser).toHaveBeenCalledWith(null);
    });

    getVerifiedAuthUserMock.mockRejectedValue(missingAccountError);
    await authChangeHandler?.('TOKEN_REFRESHED', { user: authUser });
    await appStateHandler?.('active');

    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });
});
