import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeSignupRedirect,
  preparePasswordResetRedirect,
  updateRecoveredPassword,
} from '@/mobile/app/app-shell/auth/session/authRedirectHandlers';

const {
  clearCurrentUserStateMock,
  clearPendingAuthRedirectStatesMock,
  consumePendingAuthRedirectStateMock,
  exchangeCodeForSessionMock,
  loggerDebugMock,
  persistAuthSessionMock,
  setSessionMock,
  signOutMock,
  updateUserMock,
} = vi.hoisted(() => ({
  clearCurrentUserStateMock: vi.fn(),
  clearPendingAuthRedirectStatesMock: vi.fn(),
  consumePendingAuthRedirectStateMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  persistAuthSessionMock: vi.fn(),
  setSessionMock: vi.fn(),
  signOutMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock('@/mobile/app/app-shell/auth/session/authSessionSupport', () => ({
  clearCurrentUserState: clearCurrentUserStateMock,
  persistAuthSession: persistAuthSessionMock,
}));

vi.mock('@/mobile/app/app-shell/auth/session/authRedirectState', () => ({
  clearPendingAuthRedirectStates: clearPendingAuthRedirectStatesMock,
  consumePendingAuthRedirectState: consumePendingAuthRedirectStateMock,
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      setSession: setSessionMock,
      signOut: signOutMock,
      updateUser: updateUserMock,
    },
  },
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
};

describe('authRedirectHandlers', () => {
  beforeEach(() => {
    clearCurrentUserStateMock.mockReset();
    persistAuthSessionMock.mockReset();
    clearPendingAuthRedirectStatesMock.mockReset();
    consumePendingAuthRedirectStateMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    setSessionMock.mockReset();
    signOutMock.mockReset();
    updateUserMock.mockReset();
    loggerDebugMock.mockReset();

    clearPendingAuthRedirectStatesMock.mockResolvedValue(undefined);
    persistAuthSessionMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue(undefined);
  });

  it('completes signup redirects from authorization codes', async () => {
    consumePendingAuthRedirectStateMock.mockResolvedValue({
      success: true,
      entry: {
        flow: 'signup',
        state: 'state-1',
        target: 'auth/callback',
      },
    });
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session },
      error: null,
    });

    await completeSignupRedirect({
      code: 'code-1',
      flow: 'signup',
      state: 'state-1',
      target: 'auth/callback',
    });

    expect(consumePendingAuthRedirectStateMock).toHaveBeenCalledWith({
      flow: 'signup',
      state: 'state-1',
      target: 'auth/callback',
    });
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('code-1');
    expect(persistAuthSessionMock).toHaveBeenCalledWith(session);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('prepares password reset redirects from token payloads', async () => {
    consumePendingAuthRedirectStateMock.mockResolvedValue({
      success: true,
      entry: {
        flow: 'password-reset',
        state: 'state-1',
        target: 'reset-password',
      },
    });
    setSessionMock.mockResolvedValue({
      data: { session },
      error: null,
    });

    await preparePasswordResetRedirect({
      accessToken: 'access-token',
      flow: 'password-reset',
      refreshToken: 'refresh-token',
      state: 'state-1',
      target: 'reset-password',
    });

    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(persistAuthSessionMock).toHaveBeenCalledWith(session);
  });

  it('clears rejected payloads for provider errors and invalid state', async () => {
    await expect(
      completeSignupRedirect({
        error: 'access_denied',
        errorCode: 'provider',
        target: 'auth/callback',
      }),
    ).rejects.toThrow('provider: access_denied');

    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(clearPendingAuthRedirectStatesMock).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
    expect(clearCurrentUserStateMock).toHaveBeenCalled();

    await expect(
      completeSignupRedirect({ error: 'plain_provider_error', target: 'auth/callback' }),
    ).rejects.toThrow('plain_provider_error');

    persistAuthSessionMock.mockClear();
    clearPendingAuthRedirectStatesMock.mockClear();
    signOutMock.mockClear();
    clearCurrentUserStateMock.mockClear();
    consumePendingAuthRedirectStateMock.mockResolvedValue({ success: false, reason: 'state_not_found' });

    await expect(
      preparePasswordResetRedirect({
        code: 'code-1',
        flow: 'signup',
        state: 'missing',
        target: 'reset-password',
      }),
    ).rejects.toThrow();

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(clearPendingAuthRedirectStatesMock).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
    expect(clearCurrentUserStateMock).toHaveBeenCalled();

    consumePendingAuthRedirectStateMock.mockResolvedValue({
      success: true,
      entry: { flow: 'password-reset', state: 'state-2', target: 'auth/callback' },
    });
    await expect(
      completeSignupRedirect({
        code: 'code-2', flow: 'password-reset', state: 'state-2', target: 'auth/callback',
      }),
    ).rejects.toThrow();
  });

  it('rejects missing or invalid session payloads and logs sign-out cleanup failures', async () => {
    consumePendingAuthRedirectStateMock.mockResolvedValue({
      success: true,
      entry: {
        flow: 'signup',
        state: 'state-1',
        target: 'auth/callback',
      },
    });
    signOutMock.mockRejectedValue(new Error('network'));

    await expect(
      completeSignupRedirect({
        flow: 'signup',
        state: 'state-1',
        target: 'auth/callback',
      }),
    ).rejects.toThrow();

    expect(loggerDebugMock).toHaveBeenCalled();

    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error('exchange failed'),
    });
    signOutMock.mockResolvedValue(undefined);

    await expect(
      completeSignupRedirect({
        code: 'code-1',
        flow: 'signup',
        state: 'state-1',
        target: 'auth/callback',
      }),
    ).rejects.toThrow('exchange failed');

    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    await expect(
      completeSignupRedirect({
        code: 'code-2', flow: 'signup', state: 'state-1', target: 'auth/callback',
      }),
    ).rejects.toThrow();

    consumePendingAuthRedirectStateMock.mockResolvedValue({
      success: true,
      entry: { flow: 'password-reset', state: 'state-reset', target: 'reset-password' },
    });
    setSessionMock
      .mockResolvedValueOnce({ data: { session: null }, error: new Error('set session failed') })
      .mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(
      preparePasswordResetRedirect({
        accessToken: 'access', refreshToken: 'refresh', flow: 'password-reset',
        state: 'state-reset', target: 'reset-password',
      }),
    ).rejects.toThrow('set session failed');
    await expect(
      preparePasswordResetRedirect({
        accessToken: 'access', refreshToken: 'refresh', flow: 'password-reset',
        state: 'state-reset', target: 'reset-password',
      }),
    ).rejects.toThrow();
  });

  it('updates recovered passwords and clears temporary reset sessions', async () => {
    updateUserMock.mockResolvedValue({ error: null });

    await updateRecoveredPassword('new-password');

    expect(updateUserMock).toHaveBeenCalledWith({ password: 'new-password' });
    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(signOutMock).toHaveBeenCalled();
    expect(clearCurrentUserStateMock).toHaveBeenCalled();

    updateUserMock.mockResolvedValue({ error: new Error('weak password') });
    await expect(updateRecoveredPassword('weak')).rejects.toThrow('weak password');

    updateUserMock.mockResolvedValue({ error: null });
    signOutMock.mockRejectedValue(new Error('sign-out network failure'));
    await updateRecoveredPassword('another-valid-password');
    expect(loggerDebugMock).toHaveBeenCalledWith(
      'auth',
      'Failed to sign out after updating recovered password',
      expect.any(Error),
    );
  });
});
