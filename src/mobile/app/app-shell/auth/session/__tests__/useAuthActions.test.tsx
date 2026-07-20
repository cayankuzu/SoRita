import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import {
  EMAIL_MAX_LENGTH,
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

const clearCurrentUserStateMock = vi.fn();
const persistAuthSessionMock = vi.fn();
const persistResolvedAuthUserMock = vi.fn();
const resolveImmediateAuthUserMock = vi.fn();
const syncAuthenticatedUserMock = vi.fn();
const createTrackedAuthRedirectMock = vi.fn();
const discardPendingAuthRedirectStateMock = vi.fn();
const unregisterPushNotificationsMock = vi.fn();
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
const clearOutboxForUserMock = vi.fn();

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
  clearCurrentUserState: clearCurrentUserStateMock,
  persistAuthSession: persistAuthSessionMock,
  persistResolvedAuthUser: persistResolvedAuthUserMock,
  resolveImmediateAuthUser: resolveImmediateAuthUserMock,
  syncAuthenticatedUser: syncAuthenticatedUserMock,
}));

vi.mock('@/mobile/app/app-shell/auth/session/authRedirectState', () => ({
  createTrackedAuthRedirect: createTrackedAuthRedirectMock,
  discardPendingAuthRedirectState: discardPendingAuthRedirectStateMock,
}));

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  unregisterPushNotifications: unregisterPushNotificationsMock,
}));

vi.mock('@/mobile/app/data/repositories/systemPushNotificationRepository', () => ({
  unregisterSystemPushNotifications: unregisterSystemPushNotificationsMock,
}));

vi.mock('@/mobile/app/data/outbox/outboxStorage', () => ({
  clearOutboxForUser: clearOutboxForUserMock,
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
    warn: loggerWarnMock,
  },
}));

vi.mock('@/mobile/app/shared/utils/contentModeration', () => ({
  assertNoObjectionableContent: assertNoObjectionableContentMock,
}));

describe('useAuthActions', () => {
  beforeEach(() => {
    clearCurrentUserStateMock.mockReset();
    persistAuthSessionMock.mockReset();
    persistResolvedAuthUserMock.mockReset();
    resolveImmediateAuthUserMock.mockReset();
    syncAuthenticatedUserMock.mockReset();
    createTrackedAuthRedirectMock.mockReset();
    discardPendingAuthRedirectStateMock.mockReset();
    unregisterPushNotificationsMock.mockReset();
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
    clearOutboxForUserMock.mockReset();

    createTrackedAuthRedirectMock.mockImplementation((flow: string) => ({
      flow,
      state: `${flow}-state`,
      url:
        flow === 'signup'
          ? `https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=${flow}-state`
          : `https://cayankuzu.github.io/SoRita_web/reset-password/?flow=password-reset&state=${flow}-state`,
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
    unregisterPushNotificationsMock.mockResolvedValue(undefined);
    unregisterSystemPushNotificationsMock.mockResolvedValue(undefined);
    clearOutboxForUserMock.mockResolvedValue(undefined);
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

  it('falls back to direct Supabase login when the auth gateway is missing', async () => {
    const setUser = vi.fn();
    const immediateUser = { id: 'user-1', email: 'ada@example.com', name: 'Ada' };
    const syncedUser = { ...immediateUser, username: 'ada' };

    callJsonEdgeFunctionMock.mockRejectedValue(new MockEdgeFunctionError('Requested function was not found', 404));
    isMissingEdgeFunctionErrorMock.mockReturnValue(true);
    resolveImmediateAuthUserMock.mockReturnValue(immediateUser);
    syncAuthenticatedUserMock.mockResolvedValue(syncedUser);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.login(' ada@example.com ', 'secret')).resolves.toEqual({
        success: true,
      });
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'secret',
    });
    expect(persistAuthSessionMock).toHaveBeenCalledWith({
      access_token: 'fallback-access',
      refresh_token: 'fallback-refresh',
    });
    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith(syncedUser);
    });
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
      redirectUrl: 'https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=signup-state',
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

  it('falls back to direct Supabase auth flows when the auth gateway is unavailable', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockRejectedValue(new MockEdgeFunctionError('Requested function was not found', 404));
    isMissingEdgeFunctionErrorMock.mockReturnValue(true);

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
        success: true,
        code: 'signup_pending_confirmation',
      });
      await expect(hook.result.current.resendConfirmationEmail('ada@example.com')).resolves.toEqual({
        success: true,
      });
      await expect(hook.result.current.requestPasswordResetEmail('ada@example.com')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'Şifre sıfırlama maili gönderilemedi',
      });
      await expect(hook.result.current.requestPasswordReset('secret123')).resolves.toEqual({
        success: true,
      });
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'P@ssword123',
      options: expect.objectContaining({
        emailRedirectTo:
          'https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=signup-state',
      }),
    });
    expect(resendMock).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ada@example.com',
      options: {
        emailRedirectTo:
          'https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=signup-state',
      },
    });
    expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'secret123',
    });
  });

  it('returns the email-not-found error from the auth gateway for forgot password requests', async () => {
    const setUser = vi.fn();
    callJsonEdgeFunctionMock.mockRejectedValue(
      new MockEdgeFunctionError('Bu e-posta adresiyle kayitli bir hesap bulunamadi.', 404, 'email_not_found'),
    );

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.requestPasswordResetEmail('ada@example.com')).resolves.toEqual({
        success: false,
        code: 'email_not_found',
        message: 'Bu e-posta adresiyle kayitli bir hesap bulunamadi.',
      });
    });

    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(discardPendingAuthRedirectStateMock).toHaveBeenCalledWith('password-reset-state');
  });

  it('falls back to direct Supabase register when the auth gateway returns an unexpected server error', async () => {
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
        success: true,
        code: 'signup_pending_confirmation',
      });
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'P@ssword123',
      options: expect.objectContaining({
        emailRedirectTo:
          'https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=signup-state',
      }),
    });
    expect(savePendingSignupMediaMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
      profilePhoto: 'file://profile.jpg',
      coverPhoto: 'file://cover.jpg',
    });
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
    expect(clearCurrentUserStateMock).toHaveBeenCalled();
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
      redirectUrl:
        'https://cayankuzu.github.io/SoRita_web/reset-password/?flow=password-reset&state=password-reset-state',
    });
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'resend-confirmation',
      email: 'ada@example.com',
      redirectUrl:
        'https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=signup-state',
    });
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith(
      'auth-gateway',
      {
        action: 'request-password-reset-authenticated',
        currentPassword: 'secret123',
        redirectUrl:
          'https://cayankuzu.github.io/SoRita_web/reset-password/?flow=password-reset&state=password-reset-state',
      },
      {
        accessToken: 'session-token',
      },
    );
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(unregisterPushNotificationsMock).toHaveBeenCalledWith(null);
    expect(unregisterSystemPushNotificationsMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalled();
    expect(clearCurrentUserStateMock).toHaveBeenCalled();
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

  it('maps every direct-login provider error and missing-session shape', async () => {
    const setUser = vi.fn();
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));
    const cases = [
      ['Email not confirmed', 'email_not_confirmed'],
      ['Invalid login credentials', 'invalid_credentials'],
      ['Password is known to be weak', 'weak_password'],
      ['weak and easy to guess', 'weak_password'],
      ['weak password', 'weak_password'],
      ['User already registered', 'duplicate_email'],
      ['already registered', 'duplicate_email'],
      ['already exists', 'duplicate_email'],
      ['profiles_email_key', 'duplicate_email'],
      ['users_email_key', 'duplicate_email'],
      ['profiles_username_key', 'duplicate_username'],
      ['username already', 'duplicate_username'],
      ['username duplicate', 'duplicate_username'],
      ['other', 'unexpected'],
    ] as const;

    for (const [message, code] of cases) {
      callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('gateway missing'));
      isMissingEdgeFunctionErrorMock.mockReturnValueOnce(true);
      signInWithPasswordMock.mockResolvedValueOnce({ data: { session: null, user: null }, error: new Error(message) });
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toMatchObject({ code, success: false });
    }

    callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('gateway missing'));
    isMissingEdgeFunctionErrorMock.mockReturnValueOnce(true);
    signInWithPasswordMock.mockResolvedValueOnce({ data: { session: null, user: null }, error: 'unknown' });
    await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({
      success: false, code: 'unexpected',
    });

    for (const data of [
      { session: null, user: { id: 'user-1' } },
      { session: { access_token: 'a', refresh_token: 'r' }, user: null },
    ]) {
      callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('gateway missing'));
      isMissingEdgeFunctionErrorMock.mockReturnValueOnce(true);
      signInWithPasswordMock.mockResolvedValueOnce({ data, error: null });
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toMatchObject({
        success: false, code: 'unexpected',
      });
    }
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

  it('maps direct registration and resend failures and discards redirect state', async () => {
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

    for (const [message, code] of [
      ['profiles_username_key', 'duplicate_username'],
      ['Password is known to be weak', 'weak_password'],
      ['User already registered', 'duplicate_email'],
      ['provider failed', 'unexpected'],
    ] as const) {
      callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('misconfigured', 500, 'misconfigured'));
      signUpMock.mockResolvedValueOnce({ data: { user: null }, error: new Error(message) });
      await expect(hook.result.current.register(registration)).resolves.toMatchObject({ success: false, code });
    }

    callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('network'));
    signUpMock.mockResolvedValueOnce({ data: { user: null }, error: 'unknown' });
    await expect(hook.result.current.register(registration)).resolves.toEqual({ success: false, code: 'unexpected' });

    callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('blocked', 400, 'rate_limited'));
    await expect(hook.result.current.resendConfirmationEmail('ada@example.com')).resolves.toMatchObject({
      success: false, code: 'rate_limited',
    });
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new MockEdgeFunctionError('misconfigured', 500, 'misconfigured'));
    resendMock.mockResolvedValueOnce({ error: new Error('Email not confirmed') });
    await expect(hook.result.current.resendConfirmationEmail('ada@example.com')).resolves.toMatchObject({
      success: false, code: 'email_not_confirmed',
    });
  });

  it('covers every authenticated password reset guard and direct fallback outcome', async () => {
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

    for (const userResult of [
      { data: { user: null }, error: new Error('user failed') },
      { data: { user: { id: 'user-1', email: null } }, error: null },
    ]) {
      getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null });
      callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('gateway unavailable'));
      getUserMock.mockResolvedValueOnce(userResult);
      await expect(hook.result.current.requestPasswordReset('secret')).resolves.toMatchObject({
        success: false, code: 'unexpected',
      });
    }

    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null });
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('gateway unavailable'));
    getUserMock.mockResolvedValueOnce({ data: { user: { email: 'ada@example.com' } }, error: null });
    signInWithPasswordMock.mockResolvedValueOnce({ data: { session: null }, error: new Error('Invalid login credentials') });
    await expect(hook.result.current.requestPasswordReset('wrong')).resolves.toMatchObject({
      success: false, code: 'invalid_credentials',
    });

    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null });
    callJsonEdgeFunctionMock.mockRejectedValueOnce(new Error('gateway unavailable'));
    getUserMock.mockResolvedValueOnce({ data: { user: { email: 'ada@example.com' } }, error: null });
    signInWithPasswordMock.mockResolvedValueOnce({ data: { session: null }, error: null });
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: new Error('provider failed') });
    await expect(hook.result.current.requestPasswordReset('secret')).resolves.toMatchObject({
      success: false, code: 'unexpected',
    });
  });

  it('maps password reset email non-fallback errors and contains logout cleanup failures', async () => {
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

    clearOutboxForUserMock.mockRejectedValueOnce(new Error('outbox'));
    unregisterPushNotificationsMock.mockRejectedValueOnce(new Error('push'));
    unregisterSystemPushNotificationsMock.mockRejectedValueOnce(new Error('system push'));
    await hook.result.current.logout();
    expect(loggerDebugMock).toHaveBeenCalledTimes(3);

    const anonymous = renderHook(() => useAuthActions({ user: null, setUser }));
    await anonymous.result.current.logout();
    expect(clearOutboxForUserMock).toHaveBeenCalledTimes(1);
    anonymous.unmount();
    hook.unmount();
  });
});
