import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeSignupRedirect,
  preparePasswordResetRedirect,
  updateRecoveredPassword,
} from '@/mobile/app/app-shell/auth/session/authRedirectHandlers';
import { isPasswordRecoverySessionExchangeActive } from '@/mobile/app/app-shell/auth/session/passwordRecoverySessionGuard';

const {
  clearCurrentUserStateMock,
  clearPendingAuthRedirectStatesMock,
  consumePendingAuthRedirectStateMock,
  discardPendingAuthRedirectStateMock,
  exchangeCodeForSessionMock,
  getSessionMock,
  loggerDebugMock,
  persistAuthSessionMock,
  signOutMock,
  updateUserMock,
} = vi.hoisted(() => ({
  clearCurrentUserStateMock: vi.fn(),
  clearPendingAuthRedirectStatesMock: vi.fn(),
  consumePendingAuthRedirectStateMock: vi.fn(),
  discardPendingAuthRedirectStateMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
  getSessionMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  persistAuthSessionMock: vi.fn(),
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
  discardPendingAuthRedirectState: discardPendingAuthRedirectStateMock,
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      getSession: getSessionMock,
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
    discardPendingAuthRedirectStateMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    getSessionMock.mockReset();
    signOutMock.mockReset();
    updateUserMock.mockReset();
    loggerDebugMock.mockReset();

    clearPendingAuthRedirectStatesMock.mockResolvedValue(undefined);
    discardPendingAuthRedirectStateMock.mockResolvedValue(undefined);
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

  it('prepares password reset redirects from PKCE authorization codes', async () => {
    consumePendingAuthRedirectStateMock.mockResolvedValue({
      success: true,
      entry: {
        flow: 'password-reset',
        state: 'state-1',
        target: 'reset-password',
      },
    });
    exchangeCodeForSessionMock.mockImplementation(async () => {
      expect(isPasswordRecoverySessionExchangeActive()).toBe(true);
      return { data: { session }, error: null };
    });

    await preparePasswordResetRedirect({
      code: 'reset-code',
      flow: 'password-reset',
      state: 'state-1',
      target: 'reset-password',
    });

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('reset-code');
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(isPasswordRecoverySessionExchangeActive()).toBe(false);
  });

  it('clears rejected signup payloads without signing out for reset errors', async () => {
    await expect(
      completeSignupRedirect({
        error: 'access_denied',
        errorCode: 'provider',
        target: 'auth/callback',
      }),
    ).rejects.toThrow('Bu doğrulama bağlantısı geçersiz veya süresi dolmuş.');

    expect(persistAuthSessionMock).toHaveBeenCalledWith(null);
    expect(clearPendingAuthRedirectStatesMock).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
    expect(clearCurrentUserStateMock).toHaveBeenCalled();

    await expect(
      completeSignupRedirect({ error: 'plain_provider_error', target: 'auth/callback' }),
    ).rejects.toThrow('Bu doğrulama bağlantısı geçersiz veya süresi dolmuş.');

    persistAuthSessionMock.mockClear();
    clearPendingAuthRedirectStatesMock.mockClear();
    discardPendingAuthRedirectStateMock.mockClear();
    signOutMock.mockClear();
    clearCurrentUserStateMock.mockClear();

    await expect(
      preparePasswordResetRedirect({
        error: 'access_denied',
        errorCode: 'otp_expired',
        state: 'reset-state',
        target: 'reset-password',
      }),
    ).rejects.toThrow(
      'Bu sıfırlama bağlantısı kullanılmış veya süresi dolmuş. Yeni bir sıfırlama e-postası iste.',
    );

    expect(discardPendingAuthRedirectStateMock).toHaveBeenCalledWith('reset-state');
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(clearPendingAuthRedirectStatesMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(clearCurrentUserStateMock).not.toHaveBeenCalled();

    persistAuthSessionMock.mockClear();
    clearPendingAuthRedirectStatesMock.mockClear();
    discardPendingAuthRedirectStateMock.mockClear();
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
    expect(discardPendingAuthRedirectStateMock).toHaveBeenCalledWith('missing');
    expect(persistAuthSessionMock).not.toHaveBeenCalled();
    expect(clearPendingAuthRedirectStatesMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(clearCurrentUserStateMock).not.toHaveBeenCalled();

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
    exchangeCodeForSessionMock
      .mockResolvedValueOnce({ data: { session: null }, error: new Error('set session failed') })
      .mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(
      preparePasswordResetRedirect({
        code: 'reset-code-1', flow: 'password-reset',
        state: 'state-reset', target: 'reset-password',
      }),
    ).rejects.toThrow('set session failed');
    await expect(
      preparePasswordResetRedirect({
        code: 'reset-code-2', flow: 'password-reset',
        state: 'state-reset', target: 'reset-password',
      }),
    ).rejects.toThrow();
  });

  it('updates recovered passwords and promotes the recovery session', async () => {
    updateUserMock.mockResolvedValue({ error: null });
    getSessionMock.mockResolvedValue({
      data: { session },
      error: null,
    });

    await expect(updateRecoveredPassword('new-password')).resolves.toBe(session);

    expect(updateUserMock).toHaveBeenCalledWith({ password: 'new-password' });
    expect(persistAuthSessionMock).toHaveBeenCalledWith(session);
    expect(signOutMock).not.toHaveBeenCalled();
    expect(clearCurrentUserStateMock).not.toHaveBeenCalled();

    updateUserMock.mockResolvedValue({ error: new Error('weak password') });
    await expect(updateRecoveredPassword('weak')).rejects.toThrow('weak password');

    updateUserMock.mockResolvedValue({ error: null });
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error('session unavailable'),
    });
    await expect(updateRecoveredPassword('another-valid-password')).rejects.toThrow(
      'session unavailable',
    );
  });
});
