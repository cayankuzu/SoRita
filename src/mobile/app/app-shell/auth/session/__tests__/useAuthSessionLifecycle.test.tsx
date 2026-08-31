import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { AUTH_BOOTSTRAP_SHELL_FALLBACK_MS } from '@/mobile/app/shared/performance/budgets';

const clearCurrentUserStateMock = vi.fn();
const getActiveOrPersistedSessionMock = vi.fn();
const getVerifiedAuthUserMock = vi.fn();
const isMissingAuthenticatedAccountErrorMock = vi.fn();
const getPersistedAuthUserSnapshotMock = vi.fn();
const persistAuthSessionMock = vi.fn();
const persistResolvedAuthUserMock = vi.fn();
const restorePersistedVisibleDataSnapshotMock = vi.fn();
const resolveImmediateAuthUserMock = vi.fn();
const syncAuthenticatedUserMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const refreshSessionMock = vi.fn();
const signOutMock = vi.fn();
const loggerDebugMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerWarnMock = vi.fn();
const isPasswordRecoverySessionExchangeActiveMock = vi.fn();
const purgeAuthenticatedUserStateMock = vi.fn();

function dispatchAuthChange<TSession>(
  handler: ((event: string, session: TSession) => void) | null,
  event: string,
  session: TSession,
) {
  if (!handler) {
    throw new Error('Auth change handler was not registered');
  }

  handler(event, session);
}

function dispatchAppStateChange(
  handler: ((state: AppStateStatus) => void) | null,
  state: AppStateStatus,
) {
  if (!handler) {
    throw new Error('AppState handler was not registered');
  }

  handler(state);
}

vi.mock('@/mobile/app/app-shell/auth/session/authSessionSupport', () => ({
  clearCurrentUserState: clearCurrentUserStateMock,
  getActiveOrPersistedSession: getActiveOrPersistedSessionMock,
  getVerifiedAuthUser: getVerifiedAuthUserMock,
  isMissingAuthenticatedAccountError: isMissingAuthenticatedAccountErrorMock,
  getPersistedAuthUserSnapshot: getPersistedAuthUserSnapshotMock,
  persistAuthSession: persistAuthSessionMock,
  persistResolvedAuthUser: persistResolvedAuthUserMock,
  restorePersistedVisibleDataSnapshot: restorePersistedVisibleDataSnapshotMock,
  resolveImmediateAuthUser: resolveImmediateAuthUserMock,
  syncAuthenticatedUser: syncAuthenticatedUserMock,
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
      refreshSession: refreshSessionMock,
      signOut: signOutMock,
    },
  },
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: loggerDebugMock,
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}));

vi.mock('@/mobile/app/app-shell/auth/session/passwordRecoverySessionGuard', () => ({
  isPasswordRecoverySessionExchangeActive: isPasswordRecoverySessionExchangeActiveMock,
}));

vi.mock('@/mobile/app/app-shell/auth/session/authUserStatePurge', () => ({
  purgeAuthenticatedUserState: purgeAuthenticatedUserStateMock,
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
    restorePersistedVisibleDataSnapshotMock.mockReset();
    resolveImmediateAuthUserMock.mockReset();
    syncAuthenticatedUserMock.mockReset();
    onAuthStateChangeMock.mockReset();
    refreshSessionMock.mockReset();
    signOutMock.mockReset();
    loggerDebugMock.mockReset();
    loggerErrorMock.mockReset();
    loggerWarnMock.mockReset();
    isPasswordRecoverySessionExchangeActiveMock.mockReset();
    purgeAuthenticatedUserStateMock.mockReset();
    isPasswordRecoverySessionExchangeActiveMock.mockReturnValue(false);
    refreshSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    signOutMock.mockResolvedValue(undefined);
    restorePersistedVisibleDataSnapshotMock.mockResolvedValue(null);
    purgeAuthenticatedUserStateMock.mockResolvedValue(undefined);

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

    dispatchAuthChange(authChangeHandler, 'INITIAL_SESSION', null);

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith(immediateUser);
      expect(setBooted).toHaveBeenCalledWith(true);
    });

    expect(persistAuthSessionMock).not.toHaveBeenCalledWith(null);

    dispatchAuthChange(authChangeHandler, 'SIGNED_IN', { user: authUser });
    await waitFor(() => {
      expect(persistAuthSessionMock).toHaveBeenCalled();
      expect(syncAuthenticatedUserMock).toHaveBeenCalledWith(authUser);
    });

    persistAuthSessionMock.mockClear();
    syncAuthenticatedUserMock.mockClear();
    setUser.mockClear();
    dispatchAuthChange(authChangeHandler, 'PASSWORD_RECOVERY', { user: authUser });

    await act(async () => {
      await Promise.resolve();
    });

    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();

    isPasswordRecoverySessionExchangeActiveMock.mockReturnValue(true);
    dispatchAuthChange(authChangeHandler, 'SIGNED_IN', { user: authUser });

    await act(async () => {
      await Promise.resolve();
    });

    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
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

    dispatchAuthChange(authChangeHandler, 'SIGNED_OUT', null);
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

    dispatchAuthChange(authChangeHandler, 'SIGNED_IN', {
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
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;

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
          'Bu hesap artık mevcut olmadığı için oturumun kapatıldı.',
        );
        expect(setUser).toHaveBeenCalledWith(null);
    });

    getVerifiedAuthUserMock.mockRejectedValue(missingAccountError);
    dispatchAuthChange(authChangeHandler, 'TOKEN_REFRESHED', { user: authUser });
    dispatchAppStateChange(appStateHandler, 'active');

    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('refreshes expiring sessions without scheduling a zero-delay revalidation loop', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const immediateUser = { id: 'user-1', email: 'user@example.com', name: 'Ada', username: 'ada' };
    const nowMs = Date.UTC(2026, 0, 1, 12, 0, 0);
    const expiringSession = {
      expires_at: Math.floor((nowMs + 60_000) / 1000),
      user: authUser,
    };
    const refreshedSession = {
      expires_at: Math.floor((nowMs + 60 * 60_000) / 1000),
      user: authUser,
    };
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;
    const unsubscribeMock = vi.fn();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    getActiveOrPersistedSessionMock.mockResolvedValue(expiringSession);
    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    resolveImmediateAuthUserMock.mockReturnValue(immediateUser);
    syncAuthenticatedUserMock.mockResolvedValue(immediateUser);
    refreshSessionMock.mockResolvedValue({ data: { session: refreshedSession }, error: null });
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() =>
      hooks.useAuthSessionLifecycle({
        setBooted,
        setUser,
      }),
    );

    await waitFor(() => {
      expect(syncAuthenticatedUserMock).toHaveBeenCalledWith(authUser);
    });

    expect(refreshSessionMock).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 0);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);

    dispatchAppStateChange(appStateHandler, 'active');

    await waitFor(() => {
      expect(refreshSessionMock).toHaveBeenCalledTimes(1);
      expect(persistAuthSessionMock).toHaveBeenCalledWith(refreshedSession);
    });

    hook.unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('opens the app shell if auth bootstrap does not settle', async () => {
    vi.useFakeTimers();

    try {
      const setBooted = vi.fn();
      const setUser = vi.fn();
      const unsubscribeMock = vi.fn();

      getPersistedAuthUserSnapshotMock.mockReturnValue(new Promise(() => undefined));
      onAuthStateChangeMock.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } },
      });

      const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
      const hook = renderHook(() =>
        hooks.useAuthSessionLifecycle({
          setBooted,
          setUser,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(AUTH_BOOTSTRAP_SHELL_FALLBACK_MS);
      });

      expect(loggerDebugMock).toHaveBeenCalledWith(
        'auth',
        'Auth bootstrap is taking longer than expected; showing app shell fallback.',
      );
      expect(setBooted).toHaveBeenCalledWith(true);
      expect(setUser).not.toHaveBeenCalled();

      hook.unmount();
      expect(unsubscribeMock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
