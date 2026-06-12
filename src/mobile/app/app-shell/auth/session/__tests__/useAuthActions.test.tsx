import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const clearCurrentUserStateMock = vi.fn();
const persistAuthSessionMock = vi.fn();
const persistResolvedAuthUserMock = vi.fn();
const resolveImmediateAuthUserMock = vi.fn();
const syncAuthenticatedUserMock = vi.fn();
const createTrackedAuthRedirectMock = vi.fn();
const discardPendingAuthRedirectStateMock = vi.fn();
const checkAccountAvailabilityMock = vi.fn();
const unregisterPushNotificationsMock = vi.fn();
const savePendingSignupMediaMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn();
const signUpMock = vi.fn();
const resendMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const getUserMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock('@/mobile/app/app-shell/auth/session/authSessionSupport', () => ({
  clearCurrentUserState: clearCurrentUserStateMock,
  getAuthErrorCode: (message?: string) => {
    if (message?.includes('registered')) {
      return 'unexpected';
    }

    return 'unexpected';
  },
  persistAuthSession: persistAuthSessionMock,
  persistResolvedAuthUser: persistResolvedAuthUserMock,
  resolveImmediateAuthUser: resolveImmediateAuthUserMock,
  syncAuthenticatedUser: syncAuthenticatedUserMock,
}));

vi.mock('@/mobile/app/app-shell/auth/session/authRedirectState', () => ({
  createTrackedAuthRedirect: createTrackedAuthRedirectMock,
  discardPendingAuthRedirectState: discardPendingAuthRedirectStateMock,
}));

vi.mock('@/mobile/app/data/repositories/accountAvailability', () => ({
  checkAccountAvailability: checkAccountAvailabilityMock,
}));

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  unregisterPushNotifications: unregisterPushNotificationsMock,
}));

vi.mock('@/mobile/app/platform/storage/pendingSignupMedia', () => ({
  savePendingSignupMedia: savePendingSignupMediaMock,
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
      resend: resendMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
      signUp: signUpMock,
    },
  },
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    warn: loggerWarnMock,
  },
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
    checkAccountAvailabilityMock.mockReset();
    unregisterPushNotificationsMock.mockReset();
    savePendingSignupMediaMock.mockReset();
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    signUpMock.mockReset();
    resendMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    getUserMock.mockReset();
    loggerWarnMock.mockReset();

    createTrackedAuthRedirectMock.mockImplementation((flow: string) => ({
      flow,
      target: flow === 'signup' ? 'auth/callback' : 'reset-password',
      state: `${flow}-state`,
      createdAt: 1,
      url:
        flow === 'signup'
          ? `https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=${flow}-state`
          : `https://cayankuzu.github.io/SoRita_web/reset-password/?flow=password-reset&state=${flow}-state`,
    }));
    discardPendingAuthRedirectStateMock.mockResolvedValue(undefined);
  });

  it('logs in, seeds the immediate user, then syncs the authenticated user', async () => {
    const setUser = vi.fn();
    const authUser = { id: 'user-1', email: 'ada@example.com' };
    const immediateUser = { id: 'user-1', email: 'ada@example.com', name: 'Ada' };
    const syncedUser = { ...immediateUser, username: 'ada' };

    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: { access_token: 'token', refresh_token: 'refresh' },
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

    expect(persistAuthSessionMock).toHaveBeenCalledWith({
      access_token: 'token',
      refresh_token: 'refresh',
    });
    expect(setUser).toHaveBeenCalledWith(immediateUser);

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith(syncedUser);
    });
  });

  it('maps unexpected signup errors to duplicate email/username via availability checks', async () => {
    const setUser = vi.fn();

    signUpMock.mockResolvedValue({
      error: {
        message: 'user already registered',
      },
    });
    checkAccountAvailabilityMock.mockResolvedValue({
      emailAvailable: false,
      usernameAvailable: true,
    });

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    let result: unknown;
    await act(async () => {
      result = await hook.result.current.register({
        bio: 'bio',
        coverPhoto: undefined,
        email: 'ada@example.com',
        interests: ['coffee'],
        legalConsent: {
          acceptedAt: '2026-04-16T12:00:00.000Z',
          documentsAccepted: ['terms', 'community', 'privacy', 'kvkk'],
          version: '2026-04-16',
        },
        name: 'Ada',
        password: 'secret123',
        profilePhoto: undefined,
        username: 'Ada',
      });
    });

    expect(result).toEqual({
      success: false,
      code: 'duplicate_email',
      message: 'user already registered',
    });
    expect(checkAccountAvailabilityMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
      username: 'ada',
    });
  });

  it('refreshes the current user, requests password reset, resends confirmation, and logs out', async () => {
    const setUser = vi.fn();
    const syncedUser = { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' };

    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'ada@example.com' },
      },
    });
    syncAuthenticatedUserMock.mockResolvedValue(syncedUser);
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: { access_token: 'token' },
        user: { id: 'user-1', email: 'ada@example.com' },
      },
      error: null,
    });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    resendMock.mockResolvedValue({ error: null });
    unregisterPushNotificationsMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue(undefined);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() =>
      useAuthActions({
        user: syncedUser,
        setUser,
      }),
    );

    await act(async () => {
      await hook.result.current.refreshUser();
      const reset = await hook.result.current.requestPasswordReset('secret123');
      const resend = await hook.result.current.resendConfirmationEmail(' ada@example.com ');
      expect(reset).toEqual({ success: true });
      expect(resend).toEqual({ success: true });
      await hook.result.current.logout();
    });

    expect(setUser).toHaveBeenCalledWith(syncedUser);
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('ada@example.com', {
      redirectTo:
        'https://cayankuzu.github.io/SoRita_web/reset-password/?flow=password-reset&state=password-reset-state',
    });
    expect(resendMock).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ada@example.com',
      options: {
        emailRedirectTo:
          'https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=signup-state',
      },
    });
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(clearCurrentUserStateMock).toHaveBeenCalled();
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('covers login failure branches and reports async sync failures', async () => {
    const setUser = vi.fn();

    signInWithPasswordMock
      .mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: 'invalid login' },
      })
      .mockResolvedValueOnce({
        data: { session: null, user: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          session: { access_token: 'token' },
          user: { id: 'user-1', email: 'ada@example.com' },
        },
        error: null,
      });
    resolveImmediateAuthUserMock.mockReturnValue({ id: 'user-1', email: 'ada@example.com' });
    syncAuthenticatedUserMock.mockRejectedValue(new Error('sync failed'));

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'invalid login',
      });
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({
        success: false,
        code: 'unexpected',
      });
      await expect(hook.result.current.login('ada@example.com', 'secret')).resolves.toEqual({
        success: true,
      });
    });

    await waitFor(() => {
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'auth',
        'Failed to sync authenticated user after login',
        expect.any(Error),
      );
    });
  });

  it('covers register fallback branches and successful signup media persistence', async () => {
    const setUser = vi.fn();

    signUpMock
      .mockResolvedValueOnce({
        error: {
          message: 'user already registered',
        },
      })
      .mockResolvedValueOnce({
        error: {
          message: 'user already registered',
        },
      })
      .mockResolvedValueOnce({
        error: null,
      });
    checkAccountAvailabilityMock
      .mockResolvedValueOnce({
        emailAvailable: true,
        usernameAvailable: false,
      })
      .mockRejectedValueOnce(new Error('availability failed'));
    savePendingSignupMediaMock.mockResolvedValue(undefined);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    const payload = {
      bio: 'bio',
      coverPhoto: 'file://cover.jpg',
      email: 'ada@example.com',
      interests: ['coffee'],
      legalConsent: {
        acceptedAt: '2026-04-16T12:00:00.000Z',
        documentsAccepted: ['terms', 'community', 'privacy', 'kvkk'],
        version: '2026-04-16',
      },
      name: 'Ada',
      password: 'secret123',
      profilePhoto: 'file://profile.jpg',
      username: 'Ada',
    };

    await act(async () => {
      await expect(hook.result.current.register(payload)).resolves.toEqual({
        success: false,
        code: 'duplicate_username',
        message: 'user already registered',
      });
      await expect(hook.result.current.register(payload)).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'user already registered',
      });
      await expect(hook.result.current.register(payload)).resolves.toEqual({
        success: true,
        code: 'signup_pending_confirmation',
      });
    });

    expect(savePendingSignupMediaMock).toHaveBeenCalledWith({
      email: 'ada@example.com',
      profilePhoto: 'file://profile.jpg',
      coverPhoto: 'file://cover.jpg',
    });
    expect(signUpMock).toHaveBeenLastCalledWith({
      email: 'ada@example.com',
      password: 'secret123',
      options: {
        emailRedirectTo:
          'https://cayankuzu.github.io/SoRita_web/auth/callback/?flow=signup&state=signup-state',
        data: {
          name: 'Ada',
          username: 'ada',
          bio: 'bio',
          interests: ['coffee'],
          legal_consent_at: '2026-04-16T12:00:00.000Z',
          legal_consent_documents: ['terms', 'community', 'privacy', 'kvkk'],
          legal_consent_version: '2026-04-16',
          community_safety_acknowledged: true,
        },
      },
    });
  });

  it('rejects objectionable signup fields before calling Supabase', async () => {
    const setUser = vi.fn();
    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const hook = renderHook(() => useAuthActions({ user: null, setUser }));

    await act(async () => {
      await expect(hook.result.current.register({
        bio: 'temiz',
        coverPhoto: undefined,
        email: 'ada@example.com',
        interests: ['coffee'],
        legalConsent: {
          acceptedAt: '2026-04-16T12:00:00.000Z',
          documentsAccepted: ['terms', 'community', 'privacy', 'kvkk'],
          version: '2026-04-16',
        },
        name: 'Ada',
        password: 'secret123',
        profilePhoto: undefined,
        username: 'a.m.k',
      })).rejects.toThrow('Kullanici adi topluluk kurallarina aykiri ifade iceriyor.');
    });

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('covers refresh-user empty auth, password reset failures, resend failure, and resilient logout', async () => {
    const setUser = vi.fn();

    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
    });
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'wrong password' },
    });
    resendMock.mockResolvedValue({ error: { message: 'resend failed' } });
    unregisterPushNotificationsMock.mockRejectedValue(new Error('push failed'));
    signOutMock.mockResolvedValue(undefined);

    const { useAuthActions } = await import('@/mobile/app/app-shell/auth/session/useAuthActions');
    const noUserHook = renderHook(() => useAuthActions({ user: null, setUser }));
    const userHook = renderHook(() =>
      useAuthActions({
        user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', username: 'ada' },
        setUser,
      }),
    );

    await act(async () => {
      await noUserHook.result.current.refreshUser();
      await expect(noUserHook.result.current.requestPasswordReset('secret')).resolves.toEqual({
        success: false,
        code: 'unexpected',
      });
      await expect(userHook.result.current.requestPasswordReset('secret')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'wrong password',
      });
      await expect(userHook.result.current.resendConfirmationEmail(' ada@example.com ')).resolves.toEqual({
        success: false,
        code: 'unexpected',
        message: 'resend failed',
      });
      await userHook.result.current.logout();
    });

    expect(clearCurrentUserStateMock).toHaveBeenCalled();
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(setUser).toHaveBeenCalledWith(null);
  });
});
