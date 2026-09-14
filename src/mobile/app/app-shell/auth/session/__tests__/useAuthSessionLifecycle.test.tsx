import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import {
  AUTH_BOOTSTRAP_SHELL_FALLBACK_MS,
  STARTUP_CACHE_RESTORE_BUDGET_MS,
} from '@/mobile/app/shared/performance/budgets';

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
const stageActivePushTokenCleanupForAuthTransitionMock = vi.fn();

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

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  stageActivePushTokenCleanupForAuthTransition: stageActivePushTokenCleanupForAuthTransitionMock,
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
    stageActivePushTokenCleanupForAuthTransitionMock.mockReset();
    isPasswordRecoverySessionExchangeActiveMock.mockReturnValue(false);
    refreshSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    signOutMock.mockResolvedValue(undefined);
    restorePersistedVisibleDataSnapshotMock.mockResolvedValue(null);
    purgeAuthenticatedUserStateMock.mockResolvedValue(undefined);
    stageActivePushTokenCleanupForAuthTransitionMock.mockResolvedValue(null);

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
      expect(syncAuthenticatedUserMock).toHaveBeenCalledWith(authUser, {
        isCurrent: expect.any(Function),
      });
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

  it('stages the prior device token capability before a signed-in account changes', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const userA = { id: 'user-a', email: 'a@example.com' };
    const userB = { id: 'user-b', email: 'b@example.com' };
    let authChangeHandler: ((event: string, session: { user: typeof userA } | null) => void) | null = null;

    getActiveOrPersistedSessionMock.mockResolvedValue({ user: userA });
    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getVerifiedAuthUserMock.mockResolvedValue(userA);
    resolveImmediateAuthUserMock.mockReturnValue({
      id: 'user-a', email: 'a@example.com', name: 'A', username: 'user_a',
    });
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockImplementation((callback) => {
      authChangeHandler = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));
    await waitFor(() => expect(setUser).toHaveBeenCalled());

    getVerifiedAuthUserMock.mockResolvedValue(userB);
    resolveImmediateAuthUserMock.mockReturnValue({
      id: 'user-b', email: 'b@example.com', name: 'B', username: 'user_b',
    });
    const cleanupError = new Error('push cleanup unavailable');
    stageActivePushTokenCleanupForAuthTransitionMock.mockRejectedValueOnce(cleanupError);
    dispatchAuthChange(authChangeHandler, 'SIGNED_IN', { user: userB });

    await waitFor(() => {
      expect(stageActivePushTokenCleanupForAuthTransitionMock).toHaveBeenCalledOnce();
      expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith('user-a');
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'auth',
        'Could not stage push cleanup during auth transition.',
        { error: 'Error' },
      );
    });
  });

  it('does not let a stale user sync overwrite a newer auth scope', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const userA = { id: 'user-a', email: 'a@example.com' };
    const userB = { id: 'user-b', email: 'b@example.com' };
    const immediateUserA = {
      id: userA.id, email: userA.email, name: 'A', username: 'user_a',
    };
    const immediateUserB = {
      id: userB.id, email: userB.email, name: 'B', username: 'user_b',
    };
    const bootstrappedUserA = { ...immediateUserA, bio: 'bootstrapped' };
    const staleSyncedUserA = { ...immediateUserA, bio: 'stale-result' };
    const syncedUserB = { ...immediateUserB, bio: 'current-result' };
    let resolveStaleUserA!: (user: typeof staleSyncedUserA) => void;
    let staleUserAGuard: () => boolean = () => false;
    const staleUserASync = new Promise<typeof staleSyncedUserA>((resolve) => {
      resolveStaleUserA = resolve;
    });
    let authChangeHandler: ((event: string, session: { user: typeof userA } | null) => void) | null = null;

    getActiveOrPersistedSessionMock.mockResolvedValue({ user: userA });
    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getVerifiedAuthUserMock.mockImplementation(async (session) => session?.user ?? null);
    resolveImmediateAuthUserMock.mockImplementation((authUser) =>
      authUser.id === userA.id ? immediateUserA : immediateUserB);
    syncAuthenticatedUserMock
      .mockResolvedValueOnce(bootstrappedUserA)
      .mockImplementationOnce((_authUser, options) => {
        staleUserAGuard = options?.isCurrent ?? (() => false);
        return staleUserASync;
      })
      .mockResolvedValueOnce(syncedUserB);
    onAuthStateChangeMock.mockImplementation((callback) => {
      authChangeHandler = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith(bootstrappedUserA);
    });

    setUser.mockClear();
    syncAuthenticatedUserMock.mockClear();
    dispatchAuthChange(authChangeHandler, 'TOKEN_REFRESHED', { user: userA });

    await waitFor(() => {
      expect(syncAuthenticatedUserMock).toHaveBeenCalledTimes(1);
      expect(staleUserAGuard()).toBe(true);
    });

    dispatchAuthChange(authChangeHandler, 'SIGNED_IN', { user: userB });

    expect(staleUserAGuard()).toBe(false);
    expect(setUser).toHaveBeenCalledWith(null);
    expect(syncAuthenticatedUserMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStaleUserA(staleSyncedUserA);
      await staleUserASync;
    });

    await waitFor(() => {
      expect(syncAuthenticatedUserMock).toHaveBeenCalledTimes(2);
      expect(setUser).toHaveBeenCalledWith(syncedUserB);
    });

    expect(setUser).not.toHaveBeenCalledWith(staleSyncedUserA);
    expect(syncAuthenticatedUserMock.mock.calls[1]?.[0]).toEqual(userB);
  });

  it('keeps a new auth scope closed until the previous user purge succeeds', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const userA = { id: 'user-a', email: 'a@example.com' };
    const userB = { id: 'user-b', email: 'b@example.com' };
    const immediateUserA = {
      id: 'user-a', email: 'a@example.com', name: 'A', username: 'user_a',
    };
    const immediateUserB = {
      id: 'user-b', email: 'b@example.com', name: 'B', username: 'user_b',
    };
    const purgeError = new Error('purge failed');
    let rejectPendingPurge: ((reason: Error) => void) | null = null;
    const pendingPurge = new Promise<void>((_resolve, reject) => {
      rejectPendingPurge = reject;
    });
    let authChangeHandler: ((event: string, session: { user: typeof userA } | null) => void) | null = null;
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;

    getActiveOrPersistedSessionMock
      .mockResolvedValueOnce({ user: userA })
      .mockResolvedValue({ user: userB });
    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getVerifiedAuthUserMock.mockImplementation(async (session) => session?.user ?? null);
    resolveImmediateAuthUserMock.mockImplementation((authUser) =>
      authUser.id === userA.id ? immediateUserA : immediateUserB);
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockImplementation((callback) => {
      authChangeHandler = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith(immediateUserA);
    });

    setUser.mockClear();
    clearCurrentUserStateMock.mockClear();
    resolveImmediateAuthUserMock.mockClear();
    persistResolvedAuthUserMock.mockClear();
    purgeAuthenticatedUserStateMock.mockClear();
    purgeAuthenticatedUserStateMock
      .mockImplementationOnce(() => pendingPurge)
      .mockResolvedValue(undefined);

    dispatchAuthChange(authChangeHandler, 'SIGNED_IN', { user: userB });

    await waitFor(() => {
      expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith(userA.id);
      expect(clearCurrentUserStateMock).toHaveBeenCalled();
      expect(setUser).toHaveBeenCalledWith(null);
    });

    expect(resolveImmediateAuthUserMock).not.toHaveBeenCalledWith(userB);
    expect(persistResolvedAuthUserMock).not.toHaveBeenCalledWith(immediateUserB);

    await act(async () => {
      rejectPendingPurge?.(purgeError);
      await pendingPurge.catch(() => undefined);
    });

    await waitFor(() => {
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'auth',
        'Failed to fully purge the previous auth scope.',
        { name: 'Error' },
      );
      expect(setUser).toHaveBeenLastCalledWith(null);
    });

    dispatchAppStateChange(appStateHandler, 'active');

    await waitFor(() => {
      expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledTimes(2);
      expect(setUser).toHaveBeenCalledWith(immediateUserB);
    });

    expect(purgeAuthenticatedUserStateMock).toHaveBeenNthCalledWith(2, userA.id);
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
      expect(syncAuthenticatedUserMock).toHaveBeenCalledWith(authUser, {
        isCurrent: expect.any(Function),
      });
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

  async function mountWithExpiringSession(refreshResult: unknown) {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const immediateUser = { id: 'user-1', email: 'user@example.com', name: 'Ada', username: 'ada' };
    const nowMs = Date.UTC(2026, 0, 1, 12, 0, 0);
    const expiringSession = {
      expires_at: Math.floor((nowMs + 60_000) / 1000),
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
    refreshSessionMock.mockResolvedValue(refreshResult);
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

    await waitFor(() => {
      expect(syncAuthenticatedUserMock).toHaveBeenCalledWith(authUser, {
        isCurrent: expect.any(Function),
      });
    });

    dispatchAppStateChange(appStateHandler, 'active');

    return { hook, setTimeoutSpy, setUser, unsubscribeMock };
  }

  it('retries later and keeps the session when the pre-expiry refresh fails', async () => {
    const { hook, setTimeoutSpy, setUser } = await mountWithExpiringSession({
      data: { session: null },
      error: new Error('refresh failed'),
    });

    await waitFor(() => {
      expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    });

    // A failed refresh must not sign the user out; it schedules a bounded retry.
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(setUser).not.toHaveBeenCalledWith(null);
    expect(persistAuthSessionMock).not.toHaveBeenCalledWith(null);

    hook.unmount();
  });

  it('signs the user out when a successful refresh returns no account', async () => {
    const { hook, setUser } = await mountWithExpiringSession({
      data: { session: { expires_at: 0, user: null } },
      error: null,
    });

    await waitFor(() => {
      expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    });

    expect(setUser).toHaveBeenCalledWith(null);

    hook.unmount();
  });

  it('shows a persisted user immediately and waits only for the cache-restore budget', async () => {
    vi.useFakeTimers();

    try {
      const setBooted = vi.fn();
      const setUser = vi.fn();
      const persistedUser = {
        id: 'persisted-user',
        email: 'persisted@example.com',
        name: 'Persisted',
        username: 'persisted',
      };
      const authUser = { id: persistedUser.id, email: persistedUser.email };

      getPersistedAuthUserSnapshotMock.mockResolvedValue(persistedUser);
      restorePersistedVisibleDataSnapshotMock.mockReturnValue(new Promise(() => undefined));
      getActiveOrPersistedSessionMock.mockResolvedValue({ user: authUser });
      getVerifiedAuthUserMock.mockResolvedValue(authUser);
      resolveImmediateAuthUserMock.mockReturnValue(persistedUser);
      syncAuthenticatedUserMock.mockResolvedValue(null);
      onAuthStateChangeMock.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      });

      const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
      const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(setUser).toHaveBeenCalledWith(persistedUser);
      expect(setBooted).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(STARTUP_CACHE_RESTORE_BUDGET_MS);
        await Promise.resolve();
      });

      expect(setBooted).toHaveBeenCalledWith(true);
      expect(syncAuthenticatedUserMock).toHaveBeenCalledWith(authUser, {
        isCurrent: expect.any(Function),
      });
      hook.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('continues persisted bootstrap when local cache restoration fails', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const cacheError = new Error('cache unavailable');
    const persistedUser = {
      id: 'persisted-user',
      email: 'persisted@example.com',
      name: 'Persisted',
      username: 'persisted',
    };
    const authUser = { id: persistedUser.id, email: persistedUser.email };

    getPersistedAuthUserSnapshotMock.mockResolvedValue(persistedUser);
    restorePersistedVisibleDataSnapshotMock.mockRejectedValue(cacheError);
    getActiveOrPersistedSessionMock.mockResolvedValue({ user: authUser });
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    resolveImmediateAuthUserMock.mockReturnValue(persistedUser);
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

    await waitFor(() => {
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'auth',
        'Failed to restore cached startup data',
        cacheError,
      );
      expect(setBooted).toHaveBeenCalledWith(true);
    });

    hook.unmount();
  });

  it('fails bootstrap closed and tolerates primitive cleanup failures', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const bootstrapError = new Error('session storage failed');
    const persistedUser = {
      id: 'persisted-user',
      email: 'persisted@example.com',
      name: 'Persisted',
      username: 'persisted',
    };

    getPersistedAuthUserSnapshotMock.mockResolvedValue(persistedUser);
    getActiveOrPersistedSessionMock.mockRejectedValue(bootstrapError);
    stageActivePushTokenCleanupForAuthTransitionMock.mockRejectedValue('push cleanup failed');
    purgeAuthenticatedUserStateMock.mockRejectedValue('purge failed');
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

    await waitFor(() => {
      expect(loggerErrorMock).toHaveBeenCalledWith(
        'auth',
        'Failed to bootstrap auth state',
        bootstrapError,
      );
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'auth',
        'Could not stage push cleanup during auth transition.',
        { error: 'unknown' },
      );
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'auth',
        'Failed to fully purge the previous auth scope.',
        { name: 'UnknownError' },
      );
      expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
      expect(setUser).toHaveBeenLastCalledWith(null);
      expect(setBooted).toHaveBeenCalledWith(true);
    });

    hook.unmount();
  });

  it('ignores active-state revalidation during bootstrap and deduplicates it afterward', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const immediateUser = { id: authUser.id, email: authUser.email, name: 'Ada', username: 'ada' };
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;
    let resolveBootstrap!: (session: { user: typeof authUser }) => void;
    const bootstrapSession = new Promise<{ user: typeof authUser }>((resolve) => {
      resolveBootstrap = resolve;
    });

    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getActiveOrPersistedSessionMock.mockReturnValueOnce(bootstrapSession);
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    resolveImmediateAuthUserMock.mockReturnValue(immediateUser);
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

    await act(async () => {
      await Promise.resolve();
    });
    dispatchAppStateChange(appStateHandler, 'active');
    expect(getActiveOrPersistedSessionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveBootstrap({ user: authUser });
      await bootstrapSession;
    });
    await waitFor(() => expect(setBooted).toHaveBeenCalledWith(true));

    let resolveRevalidation!: (session: { user: typeof authUser }) => void;
    const revalidation = new Promise<{ user: typeof authUser }>((resolve) => {
      resolveRevalidation = resolve;
    });
    getActiveOrPersistedSessionMock.mockReturnValue(revalidation);

    dispatchAppStateChange(appStateHandler, 'active');
    dispatchAppStateChange(appStateHandler, 'active');
    expect(getActiveOrPersistedSessionMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRevalidation({ user: authUser });
      await revalidation;
    });
    hook.unmount();
  });

  it('cancels scheduled revalidation while the app is in the background', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const session = {
      expires_at: Math.floor((Date.now() + 60 * 60_000) / 1000),
      user: authUser,
    };
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getActiveOrPersistedSessionMock.mockResolvedValue(session);
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    resolveImmediateAuthUserMock.mockReturnValue({
      id: authUser.id,
      email: authUser.email,
      name: 'Ada',
      username: 'ada',
    });
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));
    await waitFor(() => expect(syncAuthenticatedUserMock).toHaveBeenCalled());

    clearTimeoutSpy.mockClear();
    dispatchAppStateChange(appStateHandler, 'background');
    expect(clearTimeoutSpy).toHaveBeenCalled();
    hook.unmount();
  });

  it('logs current revalidation failures but ignores stale failures', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const session = { user: authUser };
    const currentError = new Error('current revalidation failed');
    const staleError = new Error('stale revalidation failed');
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;
    let authChangeHandler: ((event: string, nextSession: typeof session | null) => void) | null = null;

    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getActiveOrPersistedSessionMock.mockResolvedValueOnce(session);
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    resolveImmediateAuthUserMock.mockReturnValue({
      id: authUser.id,
      email: authUser.email,
      name: 'Ada',
      username: 'ada',
    });
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockImplementation((callback) => {
      authChangeHandler = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));
    await waitFor(() => expect(syncAuthenticatedUserMock).toHaveBeenCalled());

    getActiveOrPersistedSessionMock.mockRejectedValueOnce(currentError);
    dispatchAppStateChange(appStateHandler, 'active');
    await waitFor(() => {
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'auth',
        'Failed to revalidate auth session',
        currentError,
      );
    });

    loggerWarnMock.mockClear();
    let rejectStale!: (reason: Error) => void;
    const staleRevalidation = new Promise<never>((_resolve, reject) => {
      rejectStale = reject;
    });
    getActiveOrPersistedSessionMock.mockReturnValueOnce(staleRevalidation);
    dispatchAppStateChange(appStateHandler, 'active');
    dispatchAuthChange(authChangeHandler, 'SIGNED_OUT', null);

    await act(async () => {
      rejectStale(staleError);
      await staleRevalidation.catch(() => undefined);
    });

    expect(loggerWarnMock).not.toHaveBeenCalledWith(
      'auth',
      'Failed to revalidate auth session',
      staleError,
    );
    hook.unmount();
  });

  it('handles a missing account discovered by revalidation even when sign-out fails', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const session = { user: authUser };
    const missingError = new Error('missing during revalidation');
    const signOutError = new Error('sign out failed');
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;

    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getActiveOrPersistedSessionMock
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(missingError);
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    isMissingAuthenticatedAccountErrorMock.mockImplementation((error) => error === missingError);
    resolveImmediateAuthUserMock.mockReturnValue({
      id: authUser.id,
      email: authUser.email,
      name: 'Ada',
      username: 'ada',
    });
    syncAuthenticatedUserMock.mockResolvedValue(null);
    signOutMock.mockRejectedValue(signOutError);
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));
    await waitFor(() => expect(syncAuthenticatedUserMock).toHaveBeenCalled());

    dispatchAppStateChange(appStateHandler, 'active');

    await waitFor(() => {
      expect(loggerDebugMock).toHaveBeenCalledWith(
        'auth',
        'Failed to sign out after missing account',
        signOutError,
      );
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(setUser).toHaveBeenCalledWith(null);
    });
    hook.unmount();
  });

  it('clears the active account when revalidation finds no session', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const session = { user: authUser };
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;

    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getActiveOrPersistedSessionMock.mockResolvedValueOnce(session).mockResolvedValueOnce(null);
    getVerifiedAuthUserMock.mockResolvedValue(authUser);
    resolveImmediateAuthUserMock.mockReturnValue({
      id: authUser.id,
      email: authUser.email,
      name: 'Ada',
      username: 'ada',
    });
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));
    await waitFor(() => expect(syncAuthenticatedUserMock).toHaveBeenCalled());

    dispatchAppStateChange(appStateHandler, 'active');

    await waitFor(() => {
      expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
      expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith(authUser.id);
      expect(setUser).toHaveBeenLastCalledWith(null);
    });
    hook.unmount();
  });

  it('fails closed when revalidation verifies a different account', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };
    const session = { user: authUser };
    let appStateHandler: ((state: AppStateStatus) => void) | null = null;

    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getActiveOrPersistedSessionMock.mockResolvedValue(session);
    getVerifiedAuthUserMock
      .mockResolvedValueOnce(authUser)
      .mockResolvedValueOnce({ id: 'user-2', email: 'other@example.com' });
    resolveImmediateAuthUserMock.mockReturnValue({
      id: authUser.id,
      email: authUser.email,
      name: 'Ada',
      username: 'ada',
    });
    syncAuthenticatedUserMock.mockResolvedValue(null);
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      appStateHandler = callback;
      return { remove: vi.fn() };
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));
    await waitFor(() => expect(syncAuthenticatedUserMock).toHaveBeenCalled());

    setUser.mockClear();
    dispatchAppStateChange(appStateHandler, 'active');

    await waitFor(() => expect(setUser).toHaveBeenLastCalledWith(null));
    hook.unmount();
  });

  it('fails closed when verification returns a different account', async () => {
    const setBooted = vi.fn();
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'user@example.com' };

    getPersistedAuthUserSnapshotMock.mockResolvedValue(null);
    getActiveOrPersistedSessionMock.mockResolvedValue({ user: authUser });
    getVerifiedAuthUserMock.mockResolvedValue({ id: 'user-2', email: 'other@example.com' });
    resolveImmediateAuthUserMock.mockReturnValue({
      id: authUser.id,
      email: authUser.email,
      name: 'Ada',
      username: 'ada',
    });
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    const hooks = await import('@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle');
    const hook = renderHook(() => hooks.useAuthSessionLifecycle({ setBooted, setUser }));

    await waitFor(() => {
      expect(setUser).toHaveBeenLastCalledWith(null);
      expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    });
    hook.unmount();
  });
});
