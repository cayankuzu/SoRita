import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import type { User } from '@/mobile/app/data/contracts/entities';
import {
  EMAIL_MAX_LENGTH,
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

const persistAuthSessionMock = vi.fn();
const syncAuthenticatedUserMock = vi.fn();
const createTrackedAuthRedirectMock = vi.fn();
const discardPendingAuthRedirectStateMock = vi.fn();
const unregisterAllPushNotificationsMock = vi.fn();
const preparePushNotificationLogoutCleanupMock = vi.fn();
const unregisterSystemPushNotificationsMock = vi.fn();
const savePendingSignupMediaMock = vi.fn();
const callJsonEdgeFunctionMock = vi.fn();
const isMissingEdgeFunctionErrorMock = vi.fn();
const assertNoObjectionableContentMock = vi.fn();
const getUserMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const setSessionMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn();
const signUpMock = vi.fn();
const resendMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerDebugMock = vi.fn();
const loggerErrorMock = vi.fn();
const purgeAuthenticatedUserStateMock = vi.fn();

class MockEdgeFunctionError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.code = code;
    this.name = 'EdgeFunctionError';
    this.status = status;
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

vi.mock('@/mobile/app/app-shell/auth/session/authSessionSupport', () => ({
  persistAuthSession: persistAuthSessionMock,
  syncAuthenticatedUser: syncAuthenticatedUserMock,
}));

vi.mock('@/mobile/app/app-shell/auth/session/authUserStatePurge', () => ({
  purgeAuthenticatedUserState: purgeAuthenticatedUserStateMock,
}));

vi.mock('@/mobile/app/app-shell/auth/session/authRedirectState', () => ({
  createTrackedAuthRedirect: createTrackedAuthRedirectMock,
  discardPendingAuthRedirectState: discardPendingAuthRedirectStateMock,
}));

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  preparePushNotificationLogoutCleanup: preparePushNotificationLogoutCleanupMock,
  unregisterAllPushNotifications: unregisterAllPushNotificationsMock,
}));

vi.mock('@/mobile/app/data/repositories/systemPushNotificationRepository', () => ({
  unregisterSystemPushNotifications: unregisterSystemPushNotificationsMock,
}));

vi.mock('@/mobile/app/platform/storage/pendingSignupMedia', () => ({
  savePendingSignupMedia: savePendingSignupMediaMock,
}));

vi.mock('@/mobile/app/platform/api/edgeFunctions', () => ({
  callJsonEdgeFunction: callJsonEdgeFunctionMock,
  EdgeFunctionError: MockEdgeFunctionError,
  isMissingEdgeFunctionError: isMissingEdgeFunctionErrorMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    supabaseAuthGatewayFunctionName: 'auth-gateway',
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      getUser: getUserMock,
      refreshSession: refreshSessionMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      setSession: setSessionMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
      signUp: signUpMock,
      resend: resendMock,
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

vi.mock('@/mobile/app/shared/utils/contentModeration', () => ({
  assertNoObjectionableContent: assertNoObjectionableContentMock,
}));

describe('useAuthActions', () => {
  beforeEach(() => {
    persistAuthSessionMock.mockReset();
    syncAuthenticatedUserMock.mockReset();
    createTrackedAuthRedirectMock.mockReset();
    discardPendingAuthRedirectStateMock.mockReset();
    unregisterAllPushNotificationsMock.mockReset();
    preparePushNotificationLogoutCleanupMock.mockReset();
    unregisterSystemPushNotificationsMock.mockReset();
    savePendingSignupMediaMock.mockReset();
    callJsonEdgeFunctionMock.mockReset();
    isMissingEdgeFunctionErrorMock.mockReset();
    assertNoObjectionableContentMock.mockReset();
    getUserMock.mockReset();
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    setSessionMock.mockReset();
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    signUpMock.mockReset();
    resendMock.mockReset();
    loggerWarnMock.mockReset();
    loggerDebugMock.mockReset();
    loggerErrorMock.mockReset();
    purgeAuthenticatedUserStateMock.mockReset();

    createTrackedAuthRedirectMock.mockImplementation((flow: string) => ({
      flow,
      state: `${flow}-state`,
      url:
        flow === 'signup'
          ? `sorita://auth/callback?flow=signup&state=${flow}-state`
          : `sorita://reset-password?flow=password-reset&state=${flow}-state`,
    }));
    discardPendingAuthRedirectStateMock.mockResolvedValue(undefined);
    assertNoObjectionableContentMock.mockReturnValue(undefined);
    isMissingEdgeFunctionErrorMock.mockReturnValue(false);
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
      error: null,
    });
    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'refreshed-session-token',
        },
      },
      error: null,
    });
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'ada@example.com' },
      },
      error: null,
    });
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'fallback-access',
          refresh_token: 'fallback-refresh',
        },
        user: {
          id: 'user-1',
          email: 'ada@example.com',
        },
      },
      error: null,
    });
    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'ada@example.com' },
      },
      error: null,
    });
    resendMock.mockResolvedValue({ error: null });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue(undefined);
    unregisterAllPushNotificationsMock.mockResolvedValue(undefined);
    preparePushNotificationLogoutCleanupMock.mockResolvedValue(null);
    unregisterSystemPushNotificationsMock.mockResolvedValue(undefined);
    purgeAuthenticatedUserStateMock.mockResolvedValue(undefined);
  });

  it('leaves an A-to-B login race to the lifecycle owner coordinator', async () => {
    const setUser = vi.fn();
    const userA = {
      id: 'user-a',
      email: 'a@example.com',
      name: 'User A',
      username: 'user_a',
    };
    const authUserB = { id: 'user-b', email: 'b@example.com' };
    let resolveSetSession!: (value: {
      data: {
        session: { access_token: string; refresh_token: string };
        user: typeof authUserB;
      };
      error: null;
    }) => void;
    const pendingSetSession = new Promise<Parameters<typeof resolveSetSession>[0]>((resolve) => {
      resolveSetSession = resolve;
    });

    callJsonEdgeFunctionMock.mockResolvedValue({
      session: {
        accessToken: 'edge-access',
        refreshToken: 'edge-refresh',
      },
    });
    setSessionMock.mockReturnValue(pendingSetSession);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: userA, setUser }));
    const loginResult = hook.result.current.login(' b@example.com ', 'secret');

    await waitFor(() => {
      expect(setSessionMock).toHaveBeenCalledWith({
        access_token: 'edge-access',
        refresh_token: 'edge-refresh',
      });
    });
    expect(setUser).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();

    resolveSetSession({
      data: {
        session: {
          access_token: 'edge-access',
          refresh_token: 'edge-refresh',
        },
        user: authUserB,
      },
      error: null,
    });

    await expect(loginResult).resolves.toEqual({ success: true });

    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'login',
      email: 'b@example.com',
      password: 'secret',
    });
    expect(setUser).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
  });

  it('lets only the latest concurrent login response commit a session', async () => {
    const setUser = vi.fn();
    const loginBResponse = createDeferred<{
      session: { accessToken: string; refreshToken: string };
    }>();
    const loginCResponse = createDeferred<{
      session: { accessToken: string; refreshToken: string };
    }>();
    callJsonEdgeFunctionMock.mockImplementation(
      (_functionName: string, payload: { email?: string }) =>
        payload.email === 'b@example.com' ? loginBResponse.promise : loginCResponse.promise,
    );
    setSessionMock.mockImplementation(
      ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) =>
        Promise.resolve({
          data: {
            session: { access_token, refresh_token },
            user: { id: access_token === 'access-b' ? 'user-b' : 'user-c' },
          },
          error: null,
        }),
    );

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));
    const loginB = hook.result.current.login('b@example.com', 'secret-b');
    const loginC = hook.result.current.login('c@example.com', 'secret-c');

    loginCResponse.resolve({
      session: { accessToken: 'access-c', refreshToken: 'refresh-c' },
    });
    await expect(loginC).resolves.toEqual({ success: true });

    loginBResponse.resolve({
      session: { accessToken: 'access-b', refreshToken: 'refresh-b' },
    });
    await expect(loginB).resolves.toEqual({ success: false, code: 'unexpected' });

    expect(setSessionMock).toHaveBeenCalledTimes(1);
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: 'access-c',
      refresh_token: 'refresh-c',
    });
    expect(setUser).not.toHaveBeenCalled();
  });

  it('does not let a pending login reopen a session after logout', async () => {
    const setUser = vi.fn();
    const loginResponse = createDeferred<{
      session: { accessToken: string; refreshToken: string };
    }>();
    callJsonEdgeFunctionMock.mockReturnValue(loginResponse.promise);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a' },
      setUser,
    }));
    const loginResult = hook.result.current.login('b@example.com', 'secret');

    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledOnce());
    await hook.result.current.logout();
    loginResponse.resolve({
      session: { accessToken: 'access-b', refreshToken: 'refresh-b' },
    });

    await expect(loginResult).resolves.toEqual({ success: false, code: 'unexpected' });
    expect(signOutMock).toHaveBeenCalledOnce();
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it('finishes an in-flight logout before committing a newer login', async () => {
    const setUser = vi.fn();
    const signOutResult = createDeferred<{ error: null }>();
    signOutMock.mockReturnValue(signOutResult.promise);
    callJsonEdgeFunctionMock.mockResolvedValue({
      session: { accessToken: 'access-b', refreshToken: 'refresh-b' },
    });
    setSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'access-b', refresh_token: 'refresh-b' },
        user: { id: 'user-b', email: 'b@example.com' },
      },
      error: null,
    });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a' },
      setUser,
    }));
    const logoutResult = hook.result.current.logout();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledOnce());
    const loginResult = hook.result.current.login('b@example.com', 'secret');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledOnce());
    expect(setSessionMock).not.toHaveBeenCalled();

    let resolvedLoginResult: Awaited<typeof loginResult> | undefined;
    await act(async () => {
      signOutResult.resolve({ error: null });
      await logoutResult;
      resolvedLoginResult = await loginResult;
    });

    expect(resolvedLoginResult).toEqual({ success: true });
    expect(persistAuthSessionMock.mock.invocationCallOrder.at(-1)).toBeLessThan(
      setSessionMock.mock.invocationCallOrder[0] as number,
    );
  });

  it('commits a newer login after logout updates the real provider user state', async () => {
    const userA = {
      id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a',
    };
    const signOutResult = createDeferred<{ error: null }>();
    signOutMock.mockReturnValue(signOutResult.promise);
    callJsonEdgeFunctionMock.mockResolvedValue({
      session: { accessToken: 'access-b', refreshToken: 'refresh-b' },
    });
    setSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'access-b', refresh_token: 'refresh-b' },
        user: { id: 'user-b', email: 'b@example.com' },
      },
      error: null,
    });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => {
      const [currentUser, setCurrentUser] = useState<User | null>(userA);
      return {
        actions: useAuthActions({ user: currentUser, setUser: setCurrentUser }),
        currentUser,
        setCurrentUser,
      };
    });
    const logoutResult = hook.result.current.actions.logout();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledOnce());
    const loginResult = hook.result.current.actions.login('b@example.com', 'secret');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledOnce());
    expect(setSessionMock).not.toHaveBeenCalled();

    act(() => {
      hook.result.current.setCurrentUser(null);
    });
    await waitFor(() => expect(hook.result.current.currentUser).toBeNull());
    expect(setSessionMock).not.toHaveBeenCalled();

    let resolvedLoginResult: Awaited<typeof loginResult> | undefined;
    await act(async () => {
      signOutResult.resolve({ error: null });
      await logoutResult;
      resolvedLoginResult = await loginResult;
    });

    expect(resolvedLoginResult).toEqual({ success: true });
    expect(hook.result.current.currentUser).toBeNull();
    expect(setSessionMock).toHaveBeenCalledOnce();
  });

  it('retains the logout transition until a delayed SIGNED_OUT render is consumed', async () => {
    const userA = {
      id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a',
    };
    const signOutResult = createDeferred<{ error: null }>();
    const purgeResult = createDeferred<void>();
    signOutMock.mockReturnValue(signOutResult.promise);
    purgeAuthenticatedUserStateMock.mockReturnValueOnce(purgeResult.promise);
    callJsonEdgeFunctionMock.mockResolvedValue({
      session: { accessToken: 'access-b', refreshToken: 'refresh-b' },
    });
    setSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'access-b', refresh_token: 'refresh-b' },
        user: { id: 'user-b', email: 'b@example.com' },
      },
      error: null,
    });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => {
      const [currentUser, setCurrentUser] = useState<User | null>(userA);
      return {
        actions: useAuthActions({ user: currentUser, setUser: setCurrentUser }),
        setCurrentUser,
      };
    });
    const logoutResult = hook.result.current.actions.logout();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledOnce());
    const loginResult = hook.result.current.actions.login('b@example.com', 'secret');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledOnce());

    signOutResult.resolve({ error: null });
    await waitFor(() => expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledOnce());
    act(() => {
      hook.result.current.setCurrentUser(null);
    });
    expect(setSessionMock).not.toHaveBeenCalled();

    purgeResult.resolve();
    await expect(logoutResult).resolves.toBeUndefined();
    await expect(loginResult).resolves.toEqual({ success: true });
    expect(setSessionMock).toHaveBeenCalledOnce();
  });

  it('invalidates a pending login after an external A-to-B owner transition', async () => {
    const userA = {
      id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a',
    };
    const userB = {
      id: 'user-b', email: 'b@example.com', name: 'User B', username: 'user_b',
    };
    const loginResponse = createDeferred<{
      session: { accessToken: string; refreshToken: string };
    }>();
    callJsonEdgeFunctionMock.mockReturnValue(loginResponse.promise);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => {
      const [currentUser, setCurrentUser] = useState<User | null>(userA);
      return {
        actions: useAuthActions({ user: currentUser, setUser: setCurrentUser }),
        currentUser,
        setCurrentUser,
      };
    });
    const loginResult = hook.result.current.actions.login('c@example.com', 'secret');

    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledOnce());
    act(() => {
      hook.result.current.setCurrentUser(userB);
    });
    await waitFor(() => expect(hook.result.current.currentUser).toEqual(userB));

    loginResponse.resolve({
      session: { accessToken: 'access-c', refreshToken: 'refresh-c' },
    });
    await expect(loginResult).resolves.toEqual({ success: false, code: 'unexpected' });
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it('lets a newer login win after an older setSession emits SIGNED_IN before resolving', async () => {
    const userB = {
      id: 'user-b', email: 'b@example.com', name: 'User B', username: 'user_b',
    };
    const setSessionBResult = createDeferred<{
      data: {
        session: { access_token: string; refresh_token: string };
        user: { id: string; email: string };
      };
      error: null;
    }>();
    callJsonEdgeFunctionMock.mockImplementation(
      (_functionName: string, payload: { email?: string }) => Promise.resolve({
        session: payload.email === 'b@example.com'
          ? { accessToken: 'access-b', refreshToken: 'refresh-b' }
          : { accessToken: 'access-c', refreshToken: 'refresh-c' },
      }),
    );
    setSessionMock.mockImplementation(
      ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) =>
        access_token === 'access-b'
          ? setSessionBResult.promise
          : Promise.resolve({
              data: {
                session: { access_token, refresh_token },
                user: { id: 'user-c', email: 'c@example.com' },
              },
              error: null,
            }),
    );

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => {
      const [currentUser, setCurrentUser] = useState<User | null>(null);
      return {
        actions: useAuthActions({ user: currentUser, setUser: setCurrentUser }),
        setCurrentUser,
      };
    });
    const loginB = hook.result.current.actions.login('b@example.com', 'secret-b');

    await waitFor(() => expect(setSessionMock).toHaveBeenCalledTimes(1));
    const loginC = hook.result.current.actions.login('c@example.com', 'secret-c');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledTimes(2));
    expect(setSessionMock).toHaveBeenCalledTimes(1);

    act(() => {
      hook.result.current.setCurrentUser(userB);
    });
    setSessionBResult.resolve({
      data: {
        session: { access_token: 'access-b', refresh_token: 'refresh-b' },
        user: { id: 'user-b', email: 'b@example.com' },
      },
      error: null,
    });

    await expect(loginB).resolves.toEqual({ success: true });
    await expect(loginC).resolves.toEqual({ success: true });
    expect(setSessionMock).toHaveBeenNthCalledWith(2, {
      access_token: 'access-c',
      refresh_token: 'refresh-c',
    });
  });

  it('preserves the installed login result when a newer gateway attempt fails pre-commit', async () => {
    const userB = {
      id: 'user-b', email: 'b@example.com', name: 'User B', username: 'user_b',
    };
    const setSessionBResult = createDeferred<{
      data: {
        session: { access_token: string; refresh_token: string };
        user: { id: string; email: string };
      };
      error: null;
    }>();
    callJsonEdgeFunctionMock.mockImplementation(
      (_functionName: string, payload: { email?: string }) =>
        payload.email === 'b@example.com'
          ? Promise.resolve({
              session: { accessToken: 'access-b', refreshToken: 'refresh-b' },
            })
          : Promise.reject(new Error('gateway rejected login-c')),
    );
    setSessionMock.mockReturnValue(setSessionBResult.promise);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => {
      const [currentUser, setCurrentUser] = useState<User | null>(null);
      return {
        actions: useAuthActions({ user: currentUser, setUser: setCurrentUser }),
        currentUser,
        setCurrentUser,
      };
    });
    const loginB = hook.result.current.actions.login('b@example.com', 'secret-b');

    await waitFor(() => expect(setSessionMock).toHaveBeenCalledOnce());
    const loginC = hook.result.current.actions.login('c@example.com', 'secret-c');
    await expect(loginC).resolves.toMatchObject({ success: false });

    act(() => {
      hook.result.current.setCurrentUser(userB);
    });
    setSessionBResult.resolve({
      data: {
        session: { access_token: 'access-b', refresh_token: 'refresh-b' },
        user: { id: 'user-b', email: 'b@example.com' },
      },
      error: null,
    });

    await expect(loginB).resolves.toEqual({ success: true });
    expect(hook.result.current.currentUser).toEqual(userB);
    expect(setSessionMock).toHaveBeenCalledOnce();
  });

  it('keeps the newest login valid through an older B-to-null-to-C lifecycle transition', async () => {
    const userB = {
      id: 'user-b', email: 'b@example.com', name: 'User B', username: 'user_b',
    };
    const userC = {
      id: 'user-c', email: 'c@example.com', name: 'User C', username: 'user_c',
    };
    const setSessionCResult = createDeferred<{
      data: {
        session: { access_token: string; refresh_token: string };
        user: { id: string; email: string };
      };
      error: null;
    }>();
    const loginDResponse = createDeferred<{
      session: { accessToken: string; refreshToken: string };
    }>();
    callJsonEdgeFunctionMock.mockImplementation(
      (_functionName: string, payload: { email?: string }) =>
        payload.email === 'c@example.com'
          ? Promise.resolve({
              session: { accessToken: 'access-c', refreshToken: 'refresh-c' },
            })
          : loginDResponse.promise,
    );
    setSessionMock.mockImplementation(
      ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) =>
        access_token === 'access-c'
          ? setSessionCResult.promise
          : Promise.resolve({
              data: {
                session: { access_token, refresh_token },
                user: { id: 'user-d', email: 'd@example.com' },
              },
              error: null,
            }),
    );

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => {
      const [currentUser, setCurrentUser] = useState<User | null>(userB);
      return {
        actions: useAuthActions({ user: currentUser, setUser: setCurrentUser }),
        currentUser,
        setCurrentUser,
      };
    });
    const loginC = hook.result.current.actions.login('c@example.com', 'secret-c');

    await waitFor(() => expect(setSessionMock).toHaveBeenCalledOnce());
    const loginD = hook.result.current.actions.login('d@example.com', 'secret-d');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledTimes(2));

    act(() => {
      hook.result.current.setCurrentUser(null);
    });
    await act(async () => {
      setSessionCResult.resolve({
        data: {
          session: { access_token: 'access-c', refresh_token: 'refresh-c' },
          user: { id: 'user-c', email: 'c@example.com' },
        },
        error: null,
      });
      await loginC;
    });
    act(() => {
      hook.result.current.setCurrentUser(userC);
    });

    loginDResponse.resolve({
      session: { accessToken: 'access-d', refreshToken: 'refresh-d' },
    });
    await expect(loginD).resolves.toEqual({ success: true });
    expect(setSessionMock).toHaveBeenNthCalledWith(2, {
      access_token: 'access-d',
      refresh_token: 'refresh-d',
    });
  });

  it('chains overlapping owner transitions without invalidating the newest queued login', async () => {
    const users = {
      b: { id: 'user-b', email: 'b@example.com', name: 'User B', username: 'user_b' },
      c: { id: 'user-c', email: 'c@example.com', name: 'User C', username: 'user_c' },
      d: { id: 'user-d', email: 'd@example.com', name: 'User D', username: 'user_d' },
    } satisfies Record<string, User>;
    const setSessionCResult = createDeferred<{
      data: {
        session: { access_token: string; refresh_token: string };
        user: { id: string; email: string };
      };
      error: null;
    }>();
    const setSessionDResult = createDeferred<{
      data: {
        session: { access_token: string; refresh_token: string };
        user: { id: string; email: string };
      };
      error: null;
    }>();
    const loginEResponse = createDeferred<{
      session: { accessToken: string; refreshToken: string };
    }>();
    callJsonEdgeFunctionMock.mockImplementation(
      (_functionName: string, payload: { email?: string }) => {
        if (payload.email === 'e@example.com') {
          return loginEResponse.promise;
        }

        const suffix = payload.email === 'c@example.com' ? 'c' : 'd';
        return Promise.resolve({
          session: { accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}` },
        });
      },
    );
    setSessionMock.mockImplementation(
      ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
        if (access_token === 'access-c') {
          return setSessionCResult.promise;
        }
        if (access_token === 'access-d') {
          return setSessionDResult.promise;
        }
        return Promise.resolve({
          data: {
            session: { access_token, refresh_token },
            user: { id: 'user-e', email: 'e@example.com' },
          },
          error: null,
        });
      },
    );

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => {
      const [currentUser, setCurrentUser] = useState<User | null>(users.b);
      return {
        actions: useAuthActions({ user: currentUser, setUser: setCurrentUser }),
        setCurrentUser,
      };
    });
    const loginC = hook.result.current.actions.login('c@example.com', 'secret-c');

    await waitFor(() => expect(setSessionMock).toHaveBeenCalledTimes(1));
    const loginD = hook.result.current.actions.login('d@example.com', 'secret-d');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledTimes(2));
    act(() => {
      hook.result.current.setCurrentUser(null);
    });
    setSessionCResult.resolve({
      data: {
        session: { access_token: 'access-c', refresh_token: 'refresh-c' },
        user: { id: 'user-c', email: 'c@example.com' },
      },
      error: null,
    });
    await expect(loginC).resolves.toEqual({ success: true });
    await waitFor(() => expect(setSessionMock).toHaveBeenCalledTimes(2));

    const loginE = hook.result.current.actions.login('e@example.com', 'secret-e');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledTimes(3));
    act(() => {
      hook.result.current.setCurrentUser(users.c);
    });
    act(() => {
      hook.result.current.setCurrentUser(null);
    });
    setSessionDResult.resolve({
      data: {
        session: { access_token: 'access-d', refresh_token: 'refresh-d' },
        user: { id: 'user-d', email: 'd@example.com' },
      },
      error: null,
    });
    await expect(loginD).resolves.toEqual({ success: true });
    act(() => {
      hook.result.current.setCurrentUser(users.d);
    });

    loginEResponse.resolve({
      session: { accessToken: 'access-e', refreshToken: 'refresh-e' },
    });
    await expect(loginE).resolves.toEqual({ success: true });
    expect(setSessionMock).toHaveBeenNthCalledWith(3, {
      access_token: 'access-e',
      refresh_token: 'refresh-e',
    });
  });

  it('prunes a coalesced stale logout marker before a later external sign-out', async () => {
    const users = {
      a: { id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a' },
      b: { id: 'user-b', email: 'b@example.com', name: 'User B', username: 'user_b' },
    } satisfies Record<string, User>;
    const signOutResult = createDeferred<{ error: null }>();
    const loginCResponse = createDeferred<{
      session: { accessToken: string; refreshToken: string };
    }>();
    signOutMock.mockReturnValue(signOutResult.promise);
    callJsonEdgeFunctionMock.mockImplementation(
      (_functionName: string, payload: { email?: string }) => {
        if (payload.email === 'c@example.com') {
          return loginCResponse.promise;
        }

        const suffix = payload.email === 'b@example.com' ? 'b' : 'a';
        return Promise.resolve({
          session: { accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}` },
        });
      },
    );
    setSessionMock.mockImplementation(
      ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
        const suffix = access_token === 'access-b' ? 'b' : 'a';
        return Promise.resolve({
          data: {
            session: { access_token, refresh_token },
            user: { id: `user-${suffix}`, email: `${suffix}@example.com` },
          },
          error: null,
        });
      },
    );

    let currentUser: User | null = users.a;
    const setUser = vi.fn();
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: currentUser, setUser }));
    const logout = hook.result.current.logout();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledOnce());
    const loginB = hook.result.current.login('b@example.com', 'secret-b');
    signOutResult.resolve({ error: null });
    await expect(logout).resolves.toBeUndefined();
    await expect(loginB).resolves.toEqual({ success: true });

    currentUser = users.b;
    hook.rerender();
    await expect(hook.result.current.login('a@example.com', 'secret-a')).resolves.toEqual({
      success: true,
    });
    currentUser = users.a;
    hook.rerender();

    const loginC = hook.result.current.login('c@example.com', 'secret-c');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledTimes(3));
    currentUser = null;
    hook.rerender();
    loginCResponse.resolve({
      session: { accessToken: 'access-c', refreshToken: 'refresh-c' },
    });

    await expect(loginC).resolves.toEqual({ success: false, code: 'unexpected' });
    expect(setSessionMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a queued logout terminal when a newer login fails before commit', async () => {
    const userA = {
      id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a',
    };
    const refreshResult = createDeferred<{
      data: {
        session: {
          access_token: string;
          refresh_token: string;
          user: { id: string };
        };
      };
      error: null;
    }>();
    refreshSessionMock.mockReturnValue(refreshResult.promise);
    callJsonEdgeFunctionMock.mockRejectedValue(new Error('gateway rejected login-c'));

    const setUser = vi.fn();
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: userA, setUser }));
    const refresh = hook.result.current.refreshUser();

    await waitFor(() => expect(refreshSessionMock).toHaveBeenCalledOnce());
    const logout = hook.result.current.logout();
    const loginC = hook.result.current.login('c@example.com', 'secret-c');
    await expect(loginC).resolves.toMatchObject({ success: false });
    expect(signOutMock).not.toHaveBeenCalled();

    refreshResult.resolve({
      data: {
        session: {
          access_token: 'access-a',
          refresh_token: 'refresh-a',
          user: { id: 'user-a' },
        },
      },
      error: null,
    });
    await expect(refresh).resolves.toBeUndefined();
    await expect(logout).resolves.toBeUndefined();

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith('user-a');
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('serializes push cleanup preparation before a newer login commit', async () => {
    const setUser = vi.fn();
    const preparedCleanup = createDeferred<null>();
    preparePushNotificationLogoutCleanupMock.mockReturnValue(preparedCleanup.promise);
    callJsonEdgeFunctionMock.mockResolvedValue({
      session: { accessToken: 'access-b', refreshToken: 'refresh-b' },
    });
    setSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'access-b', refresh_token: 'refresh-b' },
        user: { id: 'user-b', email: 'b@example.com' },
      },
      error: null,
    });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a' },
      setUser,
    }));
    const logoutResult = hook.result.current.logout();

    await waitFor(() => expect(preparePushNotificationLogoutCleanupMock).toHaveBeenCalledOnce());
    const loginResult = hook.result.current.login('b@example.com', 'secret');
    await waitFor(() => expect(callJsonEdgeFunctionMock).toHaveBeenCalledOnce());
    expect(setSessionMock).not.toHaveBeenCalled();

    preparedCleanup.resolve(null);
    await expect(logoutResult).resolves.toBeUndefined();
    await expect(loginResult).resolves.toEqual({ success: true });

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(persistAuthSessionMock.mock.invocationCallOrder.at(-1)).toBeLessThan(
      setSessionMock.mock.invocationCallOrder[0] as number,
    );
  });

  it('fails closed when the auth gateway is missing', async () => {
    const setUser = vi.fn();

    callJsonEdgeFunctionMock.mockRejectedValue(new MockEdgeFunctionError('Requested function was not found', 404));

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.login(' ada@example.com ', 'secret')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Requested function was not found',
      });
    });

    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('maps edge gateway failures to auth action results', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock
      .mockRejectedValueOnce(new MockEdgeFunctionError('Account locked', 423, 'account_locked'))
      .mockRejectedValueOnce(new MockEdgeFunctionError('Duplicate email', 409, 'duplicate_email'))
      .mockRejectedValueOnce(new MockEdgeFunctionError('Retry later', 429, 'rate_limited'));

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() =>
      useAuthActions({
        user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
        setUser,
      }),
    );

    await act(async () => {
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({
        success: false,
        code: 'account_locked',
        message: 'Account locked',
      });
      await expect(hook.result.current.register({
        bio: 'bio',
        coverPhoto: undefined,
        email: 'ada@example.com',
        interests: ['coffee'],
        legalConsent: {
          acceptedAt: '2026-04-16T12:00:00.000Z',
          documentsAccepted: ['terms'],
          version: '2026-04-16',
        },
        name: 'Ada',
        password: 'P@ssword123',
        profilePhoto: undefined,
        username: 'Ada',
      })).resolves.toEqual({
        success: false,
        code: 'duplicate_email',
        message: 'Duplicate email',
      });
      await expect(hook.result.current.resendConfirmationEmail('ada@example.com')).resolves.toEqual({
        success: false,
        code: 'rate_limited',
        message: 'Retry later',
      });
    });
  });

  it('registers through the auth gateway, normalizes input, and stores pending signup media', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockResolvedValue({ success: true });
    savePendingSignupMediaMock.mockResolvedValue(undefined);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.register({
        bio: 'B'.repeat(USER_BIO_MAX_LENGTH + 16),
        coverPhoto: 'file://cover.jpg',
        email: `${'A'.repeat(EMAIL_MAX_LENGTH + 20)}@example.com`,
        interests: ['coffee'],
        legalConsent: {
          acceptedAt: '2026-04-16T12:00:00.000Z',
          documentsAccepted: ['terms', 'community'],
          version: '2026-04-16',
        },
        name: ` ${'N'.repeat(USER_NAME_MAX_LENGTH + 18)} `,
        password: 'P@ssword123',
        profilePhoto: 'file://profile.jpg',
        username: ` User__${'X'.repeat(USERNAME_MAX_LENGTH + 10)}!!! `,
      })).resolves.toEqual({
        success: true,
        code: 'signup_pending_confirmation',
      });
    });

    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'register',
      bio: 'B'.repeat(USER_BIO_MAX_LENGTH),
      coverPhoto: 'file://cover.jpg',
      email: 'A'.repeat(EMAIL_MAX_LENGTH),
      interests: ['coffee'],
      legalConsent: {
        acceptedAt: '2026-04-16T12:00:00.000Z',
        documentsAccepted: ['terms', 'community'],
        version: '2026-04-16',
      },
      name: 'N'.repeat(USER_NAME_MAX_LENGTH - 1),
      password: 'P@ssword123',
      profilePhoto: 'file://profile.jpg',
      redirectUrl: 'sorita://auth/callback?flow=signup&state=signup-state',
      username: 'user__xxxxxxxxxxxxxxxxxxxxxxxx',
    });
    expect(savePendingSignupMediaMock).toHaveBeenCalledWith({
      email: 'A'.repeat(EMAIL_MAX_LENGTH),
      profilePhoto: 'file://profile.jpg',
      coverPhoto: 'file://cover.jpg',
    });
  });

  it('keeps registration successful when pending signup media persistence fails', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockResolvedValue({ success: true });
    savePendingSignupMediaMock.mockRejectedValue(new Error("Cannot read property 'reload' of undefined"));

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.register({
        bio: 'bio',
        coverPhoto: 'file://cover.jpg',
        email: 'ada@example.com',
        interests: ['coffee'],
        legalConsent: {
          acceptedAt: '2026-04-16T12:00:00.000Z',
          documentsAccepted: ['terms'],
          version: '2026-04-16',
        },
        name: 'Ada',
        password: 'P@ssword123',
        profilePhoto: 'file://profile.jpg',
        username: 'ada',
      })).resolves.toEqual({
        success: true,
        code: 'signup_pending_confirmation',
      });
    });

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'auth',
      'Failed to persist pending signup media',
      expect.any(Error),
    );
  });

  it('fails closed for every high-risk auth flow when the gateway is unavailable', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockRejectedValue(new MockEdgeFunctionError('Requested function was not found', 404));

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() =>
      useAuthActions({
        user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
        setUser,
      }),
    );

    await act(async () => {
      await expect(hook.result.current.register({
        bio: 'bio',
        coverPhoto: 'file://cover.jpg',
        email: 'ada@example.com',
        interests: ['coffee'],
        legalConsent: {
          acceptedAt: '2026-04-16T12:00:00.000Z',
          documentsAccepted: ['terms'],
          version: '2026-04-16',
        },
        name: 'Ada',
        password: 'P@ssword123',
        profilePhoto: 'file://profile.jpg',
        username: 'ada',
      })).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Requested function was not found',
      });
      await expect(hook.result.current.resendConfirmationEmail('ada@example.com')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Requested function was not found',
      });
      await expect(hook.result.current.requestPasswordResetEmail('ada@example.com')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Requested function was not found',
      });
      await expect(hook.result.current.requestPasswordReset('secret123')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Requested function was not found',
      });
    });

    expect(signUpMock).not.toHaveBeenCalled();
    expect(resendMock).not.toHaveBeenCalled();
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('fails closed when the password reset gateway is unavailable', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockRejectedValue(
      new MockEdgeFunctionError('Kimlik servisi kullanilamiyor.', 503, 'unexpected'),
    );

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.requestPasswordResetEmail('ada@example.com')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Kimlik servisi kullanilamiyor.',
      });
    });

    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(discardPendingAuthRedirectStateMock).toHaveBeenCalledWith('password-reset-state');
  });

  it('does not fall back to direct registration on a gateway server error', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockRejectedValue(
      new MockEdgeFunctionError('Kimlik dogrulama islemi tamamlanamadi.', 500, 'unexpected'),
    );

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.register({
        bio: 'bio',
        coverPhoto: 'file://cover.jpg',
        email: 'ada@example.com',
        interests: ['coffee'],
        legalConsent: {
          acceptedAt: '2026-04-16T12:00:00.000Z',
          documentsAccepted: ['terms'],
          version: '2026-04-16',
        },
        name: 'Ada',
        password: 'P@ssword123',
        profilePhoto: 'file://profile.jpg',
        username: 'ada',
      })).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Kimlik dogrulama islemi tamamlanamadi.',
      });
    });

    expect(signUpMock).not.toHaveBeenCalled();
    expect(savePendingSignupMediaMock).not.toHaveBeenCalled();
  });

  it('routes refresh hydration through the lifecycle auth event', async () => {
    const setUser = vi.fn();
    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'refreshed-session-token',
          refresh_token: 'refreshed-refresh-token',
          user: { id: 'user-1' },
        },
      },
      error: null,
    });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await act(async () => {
      await hook.result.current.refreshUser();
    });

    expect(refreshSessionMock).toHaveBeenCalledOnce();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(purgeAuthenticatedUserStateMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('publishes missing refresh sessions as lifecycle-owned local sign-outs', async () => {
    const setUser = vi.fn();
    refreshSessionMock.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a' },
      setUser,
    }));

    await expect(hook.result.current.refreshUser()).resolves.toBeUndefined();

    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(purgeAuthenticatedUserStateMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('cannot apply a stale refresh result after an A-to-B account switch', async () => {
    const setUser = vi.fn();
    let currentUser = {
      id: 'user-a', email: 'a@example.com', name: 'User A', username: 'user_a',
    };
    let resolveRefresh!: (value: {
      data: {
        session: { access_token: string; refresh_token: string; user: { id: string } } | null;
        user: { id: string } | null;
      };
      error: null;
    }) => void;
    const pendingRefresh = new Promise<Parameters<typeof resolveRefresh>[0]>((resolve) => {
      resolveRefresh = resolve;
    });
    refreshSessionMock.mockReturnValue(pendingRefresh);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: currentUser, setUser }));
    const refreshResult = hook.result.current.refreshUser();

    await waitFor(() => expect(refreshSessionMock).toHaveBeenCalledOnce());
    currentUser = {
      id: 'user-b', email: 'b@example.com', name: 'User B', username: 'user_b',
    };
    hook.rerender();

    resolveRefresh({
      data: {
        session: null,
        user: null,
      },
      error: null,
    });
    await expect(refreshResult).resolves.toBeUndefined();

    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('routes password reset, resend confirmation, and logout through the auth gateway', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockResolvedValue({ success: true });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() =>
      useAuthActions({
        user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
        setUser,
      }),
    );

    await act(async () => {
      await expect(hook.result.current.requestPasswordResetEmail(' ada@example.com ')).resolves.toEqual({
        success: true,
      });
      await expect(hook.result.current.resendConfirmationEmail(' ada@example.com ')).resolves.toEqual({
        success: true,
      });
      await expect(hook.result.current.requestPasswordReset('secret123')).resolves.toEqual({
        success: true,
      });
      await hook.result.current.logout();
    });

    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'request-password-reset',
      email: 'ada@example.com',
      redirectUrl: 'sorita://reset-password?flow=password-reset&state=password-reset-state',
    });
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'resend-confirmation',
      email: 'ada@example.com',
      redirectUrl:
        'sorita://auth/callback?flow=signup&state=signup-state',
    });
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith(
      'auth-gateway',
      {
        action: 'request-password-reset-authenticated',
        currentPassword: 'secret123',
        redirectUrl: 'sorita://reset-password?flow=password-reset&state=password-reset-state',
      },
      {
        accessToken: 'session-token',
      },
    );
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(preparePushNotificationLogoutCleanupMock).toHaveBeenCalledOnce();
    expect(unregisterAllPushNotificationsMock).toHaveBeenCalledWith(null);
    expect(unregisterSystemPushNotificationsMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalled();
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith('user-1');
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('rejects incomplete edge login sessions and maps thrown values without leaking state', async () => {
    const setUser = vi.fn();
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    for (const result of [
      { data: { session: null, user: { id: 'user-1' } }, error: null },
      { data: { session: { access_token: 'x' }, user: null }, error: null },
      { data: { session: { access_token: 'x' }, user: { id: 'user-1' } }, error: new Error('set failed') },
    ]) {
      callJsonEdgeFunctionMock.mockResolvedValueOnce({ session: { accessToken: 'a', refreshToken: 'r' } });
      setSessionMock.mockResolvedValueOnce(result);
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toMatchObject({
        success: false, code: 'unexpected',
      });
    }

    for (const [error, expected] of [
      [new MockEdgeFunctionError('edge failed', 400), { code: 'unexpected', message: 'edge failed' }],
      [new Error('network failed'), { code: 'unexpected', message: 'network failed' }],
      ['unknown failure', { code: 'unexpected' }],
    ] as const) {
      callJsonEdgeFunctionMock.mockRejectedValueOnce(error);
      isMissingEdgeFunctionErrorMock.mockReturnValueOnce(false);
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toMatchObject({
        success: false, ...expected,
      });
    }
    expect(setUser).not.toHaveBeenCalled();
  });

  it('does not start direct hydration across repeated successful logins', async () => {
    const setUser = vi.fn();
    setSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'edge-access', refresh_token: 'edge-refresh' },
        user: { id: 'user-1', email: 'ada@example.com' },
      },
      error: null,
    });
    callJsonEdgeFunctionMock.mockResolvedValue({ session: { accessToken: 'edge-access', refreshToken: 'edge-refresh' } });
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({ success: true });
    await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({ success: true });
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('maps gateway registration and resend failures and discards redirect state', async () => {
    const setUser = vi.fn();
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));
    const registration = {
      bio: '', coverPhoto: undefined, email: 'ada@example.com', interests: [],
      legalConsent: {
        acceptedAt: '2026-04-16T12:00:00.000Z', documentsAccepted: ['terms'], version: '2026-04-16',
      },
      name: 'Ada', password: 'P@ssword123', profilePhoto: undefined, username: 'ada',
    };

    callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('blocked', 400, 'duplicate_username'));
    await expect(hook.result.current.register(registration)).resolves.toMatchObject({
      success: false, code: 'duplicate_username',
    });
    expect(discardPendingAuthRedirectStateMock).toHaveBeenCalledWith('signup-state');

    callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('network'));
    await expect(hook.result.current.register(registration)).resolves.toEqual({
      success: false, code: 'unexpected', message: 'network',
    });
    expect(signUpMock).not.toHaveBeenCalled();

    callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('blocked', 400, 'rate_limited'));
    await expect(hook.result.current.resendConfirmationEmail('ada@example.com')).resolves.toMatchObject({
      success: false, code: 'rate_limited',
    });
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('misconfigured', 500, 'misconfigured'));
    await expect(hook.result.current.resendConfirmationEmail('ada@example.com')).resolves.toMatchObject({
      success: false, code: 'misconfigured',
    });
    expect(resendMock).not.toHaveBeenCalled();
  });

  it('covers authenticated password reset guards without direct fallback', async () => {
    const setUser = vi.fn();
    const activeUser = { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' };
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const anonymous = renderHook(() => useAuthActions({ user: null, setUser }));
    await expect(anonymous.result.current.requestPasswordReset('secret')).resolves.toEqual({
      success: false, code: 'unexpected',
    });
    anonymous.unmount();

    const hook = renderHook(() => useAuthActions({ user: activeUser, setUser }));
    for (const sessionResult of [
      { data: { session: null }, error: new Error('session failed') },
      { data: { session: null }, error: null },
    ]) {
      getSessionMock.mockResolvedValueOnce(sessionResult);
      await expect(hook.result.current.requestPasswordReset('secret')).resolves.toMatchObject({
        success: false, code: 'unexpected',
      });
    }

    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null });
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('invalid', 400, 'invalid_credentials'));
    await expect(hook.result.current.requestPasswordReset('secret')).resolves.toMatchObject({
      success: false, code: 'invalid_credentials',
    });

    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null });
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('gateway unavailable'));
    await expect(hook.result.current.requestPasswordReset('secret')).resolves.toMatchObject({
      success: false, code: 'unexpected',
    });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it('maps password reset email errors and contains non-security push cleanup failures', async () => {
    const setUser = vi.fn();
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' }, setUser,
    }));
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('denied', 400, 'invalid_credentials'));
    await expect(hook.result.current.requestPasswordResetEmail('ada@example.com')).resolves.toMatchObject({
      success: false, code: 'invalid_credentials', message: 'denied',
    });
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('network'));
    await expect(hook.result.current.requestPasswordResetEmail('ada@example.com')).resolves.toMatchObject({
      success: false, code: 'unexpected',
    });

    unregisterAllPushNotificationsMock.mockRejectedValueOnce(new Error('push'));
    unregisterSystemPushNotificationsMock.mockRejectedValueOnce(new Error('system push'));
    await hook.result.current.logout();
    expect(loggerDebugMock).toHaveBeenCalledTimes(2);

    const anonymous = renderHook(() => useAuthActions({ user: null, setUser }));
    await anonymous.result.current.logout();
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith(null);
    anonymous.unmount();
    hook.unmount();
  });

  it('keeps the authenticated session when a durable push cleanup tombstone cannot be prepared', async () => {
    const setUser = vi.fn();
    const preparationError = new Error('secure storage unavailable');
    preparePushNotificationLogoutCleanupMock.mockRejectedValueOnce(preparationError);
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' }, setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toBe(preparationError);

    expect(unregisterAllPushNotificationsMock).not.toHaveBeenCalled();
    expect(unregisterSystemPushNotificationsMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).not.toHaveBeenCalledWith(null);
    expect(purgeAuthenticatedUserStateMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalledWith(null);
  });

  it('finishes local cleanup before surfacing a remote sign-out failure', async () => {
    const setUser = vi.fn();
    const remoteError = new Error('remote sign-out failed');
    signOutMock.mockResolvedValueOnce({ error: remoteError });
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toBe(remoteError);

    expect(signOutMock).toHaveBeenNthCalledWith(1);
    expect(signOutMock).toHaveBeenNthCalledWith(2, { scope: 'local' });
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith('user-1');
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('reports a local provider error without masking the remote sign-out failure', async () => {
    const setUser = vi.fn();
    const remoteError = new Error('remote sign-out failed');
    const localError = new Error('local sign-out failed');
    signOutMock
      .mockResolvedValueOnce({ error: remoteError })
      .mockResolvedValueOnce({ error: localError });
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toBe(remoteError);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'auth',
      'Local Supabase sign-out failed after a remote sign-out failure.',
      { error: 'Error' },
    );
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith('user-1');
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('contains thrown remote and primitive local provider sign-out failures', async () => {
    const setUser = vi.fn();
    const remoteError = new Error('remote sign-out threw');
    signOutMock.mockRejectedValueOnce(remoteError).mockRejectedValueOnce('local sign-out threw');
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toBe(remoteError);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'auth',
      'Local Supabase sign-out threw after a remote sign-out failure.',
      { error: 'unknown' },
    );
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('reports an Error thrown by local sign-out after a remote failure', async () => {
    const setUser = vi.fn();
    const remoteError = new Error('remote sign-out failed');
    const localError = new Error('local sign-out threw');
    signOutMock.mockResolvedValueOnce({ error: remoteError }).mockRejectedValueOnce(localError);
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toBe(remoteError);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'auth',
      'Local Supabase sign-out threw after a remote sign-out failure.',
      { error: 'Error' },
    );
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('surfaces local sign-out errors when refresh discovers a missing session', async () => {
    const setUser = vi.fn();
    const localError = new Error('local sign-out failed');
    refreshSessionMock.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    signOutMock.mockResolvedValueOnce({ error: localError });
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.refreshUser()).rejects.toBe(localError);

    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
    expect(setUser).not.toHaveBeenCalled();
  });

  it('surfaces generic refresh failures without publishing a local sign-out', async () => {
    const setUser = vi.fn();
    const refreshError = new Error('refresh network failure');
    refreshSessionMock.mockResolvedValue({
      data: { session: null, user: null },
      error: refreshError,
    });
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.refreshUser()).rejects.toBe(refreshError);

    expect(signOutMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('keeps logout fail-closed for primitive push-cleanup preparation failures', async () => {
    const setUser = vi.fn();
    preparePushNotificationLogoutCleanupMock.mockRejectedValueOnce('secure storage unavailable');
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toBe('secure storage unavailable');

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'auth',
      'Push cleanup could not be prepared; logout was kept fail-closed.',
      { error: 'unknown' },
    );
    expect(signOutMock).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('reports a persisted-session cleanup failure after completing logout', async () => {
    const setUser = vi.fn();
    persistAuthSessionMock.mockRejectedValueOnce(new Error('secure session cleanup failed'));
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toThrow(
      'Local logout cleanup was incomplete.',
    );

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'auth',
      'Local logout cleanup was incomplete.',
      { failedOperations: ['persisted-auth-session'] },
    );
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith('user-1');
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('reports an authenticated-user-state cleanup failure after completing logout', async () => {
    const setUser = vi.fn();
    purgeAuthenticatedUserStateMock.mockRejectedValueOnce(new Error('user cache cleanup failed'));
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({
      user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
      setUser,
    }));

    await expect(hook.result.current.logout()).rejects.toThrow(
      'Local logout cleanup was incomplete.',
    );

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'auth',
      'Local logout cleanup was incomplete.',
      { failedOperations: ['authenticated-user-state'] },
    );
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(setUser).toHaveBeenCalledWith(null);
  });
});
