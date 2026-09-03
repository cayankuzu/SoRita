import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import {
  EMAIL_MAX_LENGTH,
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

const persistAuthSessionMock = vi.fn();
const persistResolvedAuthUserMock = vi.fn();
const resolveImmediateAuthUserMock = vi.fn();
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

vi.mock('@/mobile/app/app-shell/auth/session/authSessionSupport', () => ({
  persistAuthSession: persistAuthSessionMock,
  persistResolvedAuthUser: persistResolvedAuthUserMock,
  resolveImmediateAuthUser: resolveImmediateAuthUserMock,
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
    persistResolvedAuthUserMock.mockReset();
    resolveImmediateAuthUserMock.mockReset();
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

  it('logs in, seeds the immediate user, then syncs the authenticated user', async () => {
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'ada@example.com' };
    const immediateUser = { id: 'user-1', email: 'ada@example.com', name: 'Ada' };
    const syncedUser = { ...immediateUser, username: 'ada' };

    callJsonEdgeFunctionMock.mockResolvedValue({
      session: {
        accessToken: 'edge-access',
        refreshToken: 'edge-refresh',
      },
    });
    setSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'edge-access',
          refresh_token: 'edge-refresh',
        },
        user: authUser,
      },
      error: null,
    });
    resolveImmediateAuthUserMock.mockReturnValue(immediateUser);
    syncAuthenticatedUserMock.mockResolvedValue(syncedUser);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      const result = await hook.result.current.login(' ada@example.com ', 'secret');
      expect(result).toEqual({ success: true });
    });

    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'login',
      email: 'ada@example.com',
      password: 'secret',
    });
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: 'edge-access',
      refresh_token: 'edge-refresh',
    });
    expect(persistAuthSessionMock).toHaveBeenCalledWith({
      access_token: 'edge-access',
      refresh_token: 'edge-refresh',
    });
    expect(setUser).toHaveBeenCalledWith(immediateUser);

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith(syncedUser);
    });
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

  it('refreshes the current user and clears local auth state when no authenticated user exists', async () => {
    const setUser = vi.fn();
    const syncedUser = { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' };

    getUserMock
      .mockResolvedValueOnce({
        data: {
          user: { id: 'user-1', email: 'ada@example.com' },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          user: null,
        },
        error: null,
      });
    syncAuthenticatedUserMock.mockResolvedValue(syncedUser);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await hook.result.current.refreshUser();
      await hook.result.current.refreshUser();
    });

    expect(setUser).toHaveBeenCalledWith(syncedUser);
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith(null);
    expect(setUser).toHaveBeenCalledWith(null);
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

  it('keeps immediate login state when background profile sync returns null or fails', async () => {
    const setUser = vi.fn();
    const immediate = { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' };
    resolveImmediateAuthUserMock.mockReturnValue(immediate);
    setSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'edge-access', refresh_token: 'edge-refresh' },
        user: { id: 'user-1', email: 'ada@example.com' },
      },
      error: null,
    });
    callJsonEdgeFunctionMock.mockResolvedValue({ session: { accessToken: 'edge-access', refreshToken: 'edge-refresh' } });
    syncAuthenticatedUserMock.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('sync failed'));
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({ success: true });
    await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({ success: true });
    await waitFor(() => expect(loggerWarnMock).toHaveBeenCalledWith(
      'auth', 'Failed to sync authenticated user after login', expect.any(Error),
    ));
    expect(setUser).toHaveBeenCalledWith(immediate);
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

    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(purgeAuthenticatedUserStateMock).toHaveBeenCalledWith('user-1');
    expect(setUser).toHaveBeenCalledWith(null);
  });
});
