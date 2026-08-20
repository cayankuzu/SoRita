import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  EMAIL_MAX_LENGTH,
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

const useUsernameAvailabilityQueryMock = vi.fn();
const useEmailAvailabilityQueryMock = vi.fn();
const showToastMock = vi.fn();
const pickSingleImageMock = vi.fn();
const getPersistedLegalConsentVersionMock = vi.fn();
const savePersistedLegalConsentVersionMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useAccountAvailabilityQuery', () => ({
  useEmailAvailabilityQuery: useEmailAvailabilityQueryMock,
  useUsernameAvailabilityQuery: useUsernameAvailabilityQueryMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

vi.mock('@/mobile/app/platform/media/images', () => ({
  pickSingleImageFromPrompt: pickSingleImageMock,
}));

vi.mock('@/mobile/app/platform/storage/legalConsent', () => ({
  getPersistedLegalConsentVersion: getPersistedLegalConsentVersionMock,
  savePersistedLegalConsentVersion: savePersistedLegalConsentVersionMock,
}));

describe('useAuthScreenState', () => {
  beforeEach(() => {
    useUsernameAvailabilityQueryMock.mockReset();
    useEmailAvailabilityQueryMock.mockReset();
    showToastMock.mockReset();
    pickSingleImageMock.mockReset();
    getPersistedLegalConsentVersionMock.mockReset();
    savePersistedLegalConsentVersionMock.mockReset();

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'username ok' },
    });
    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'email ok' },
    });
    getPersistedLegalConsentVersionMock.mockResolvedValue(null);
    savePersistedLegalConsentVersionMock.mockResolvedValue(undefined);
  });

  it('handles login success, unconfirmed email, invalid login, and thrown errors', async () => {
    const loginMock = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, code: 'email_not_confirmed' })
      .mockResolvedValueOnce({ success: false, code: 'invalid_credentials' })
      .mockRejectedValueOnce(new Error('network failed'));
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: loginMock,
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.setLoginEmail('user@example.com');
      hook.result.current.setLoginPassword('secret123');
    });
    await act(async () => {
      await hook.result.current.handleLogin();
      await hook.result.current.handleLogin();
      await hook.result.current.handleLogin();
      await hook.result.current.handleLogin();
    });

    expect(hook.result.current.confirmationEmail).toBe('user@example.com');
    expect(showToastMock).toHaveBeenCalledTimes(4);
  });

  it('drives helper state, register navigation, and password hints', async () => {
    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'idle', message: 'idle username' },
    });
    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'error', message: 'email failed' },
    });
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    expect(hook.result.current.view).toBe('landing');
    expect(hook.result.current.usernameHelperTone).toBe('muted');
    expect(hook.result.current.emailHelperTone).toBe('danger');

    act(() => {
      hook.result.current.goToLogin();
    });

    expect(hook.result.current.view).toBe('login');

    act(() => {
      hook.result.current.goToLanding();
      hook.result.current.openRegister();
    });

    expect(hook.result.current.view).toBe('landing');
    expect(showToastMock).toHaveBeenCalledWith(tr.auth.legal.consentRequired, 'error');

    act(() => {
      hook.result.current.toggleLegalConsent();
    });

    act(() => {
      hook.result.current.openRegister();
      hook.result.current.setRegName('A');
      hook.result.current.updateRegisterUsername('Ada!');
      hook.result.current.setRegPassword('12345');
    });

    expect(hook.result.current.view).toBe('register');
    expect(hook.result.current.regUsername).toBe('ada');
    expect(hook.result.current.passwordHint).toBeTruthy();
    expect(hook.result.current.canContinue).toBe(false);

    act(() => {
      hook.result.current.goToNextRegisterStep();
      hook.result.current.goToPreviousRegisterStep();
      hook.result.current.handleRegisterBack();
    });

    expect(hook.result.current.regStep).toBe(0);
    expect(hook.result.current.view).toBe('landing');

    act(() => {
      hook.result.current.goToLogin();
      hook.result.current.goToLanding();
      hook.result.current.openLegalDocument('terms');
    });

    expect(hook.result.current.view).toBe('landing');
    expect(hook.result.current.activeLegalDocument).toBe('terms');

    act(() => {
      hook.result.current.closeLegalDocument();
    });

    expect(hook.result.current.activeLegalDocument).toBeNull();
  });

  it('clamps register text fields to the shared input limits', async () => {
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.openRegister();
      hook.result.current.setRegName('A'.repeat(USER_NAME_MAX_LENGTH + 12));
      hook.result.current.updateRegisterUsername(`User__${'X'.repeat(USERNAME_MAX_LENGTH + 12)}!!!`);
      hook.result.current.setRegBio('b'.repeat(USER_BIO_MAX_LENGTH + 25));
      hook.result.current.setRegEmail('m'.repeat(EMAIL_MAX_LENGTH + 40));
    });

    expect(hook.result.current.regName).toHaveLength(USER_NAME_MAX_LENGTH);
    expect(hook.result.current.regUsername).toHaveLength(USERNAME_MAX_LENGTH);
    expect(hook.result.current.regUsername).toMatch(/^[a-z0-9_]+$/);
    expect(hook.result.current.regBio).toHaveLength(USER_BIO_MAX_LENGTH);
    expect(hook.result.current.regEmail).toHaveLength(EMAIL_MAX_LENGTH);
  });

  it('runs the successful register flow, interest toggling, and resend confirmation', async () => {
    const registerMock = vi.fn().mockResolvedValue({ success: true });
    const resendMock = vi.fn().mockResolvedValue({ success: true });
    pickSingleImageMock
      .mockResolvedValueOnce('file://profile.jpg')
      .mockResolvedValueOnce('file://cover.jpg');
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: registerMock,
        resendConfirmationEmail: resendMock,
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
    });

    act(() => {
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada Lovelace');
      hook.result.current.updateRegisterUsername('Ada!');
      hook.result.current.goToNextRegisterStep();
      hook.result.current.setRegEmail('ada@example.com');
      hook.result.current.setRegPassword('Str0ng#2026');
      hook.result.current.goToNextRegisterStep();
      hook.result.current.toggleInterest('coffee');
      hook.result.current.toggleInterest('coffee');
      hook.result.current.toggleInterest('coffee');
      hook.result.current.setRegBio('first programmer');
    });

    await act(async () => {
      await hook.result.current.selectProfilePhoto();
    });
    await act(async () => {
      await hook.result.current.selectCoverPhoto();
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    await act(async () => {
      await hook.result.current.handleResendConfirmation();
    });

    expect(registerMock).toHaveBeenCalledWith({
      bio: 'first programmer',
      coverPhoto: 'file://cover.jpg',
      email: 'ada@example.com',
      interests: ['coffee'],
      legalConsent: {
        acceptedAt: expect.any(String),
        documentsAccepted: ['terms', 'community'],
        version: '2026-08-17-terms-community',
      },
      name: 'Ada Lovelace',
      password: 'Str0ng#2026',
      profilePhoto: 'file://profile.jpg',
      username: 'ada',
    });
    expect(hook.result.current.view).toBe('login');
    expect(hook.result.current.confirmationEmail).toBe('ada@example.com');
    expect(hook.result.current.loginEmail).toBe('ada@example.com');
    expect(hook.result.current.regInterests).toEqual([]);
    expect(resendMock).toHaveBeenCalledWith('ada@example.com');
  });

  it('blocks invalid register input paths', async () => {
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
    });

    act(() => {
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada');
      hook.result.current.setRegPassword('short');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.regStep).toBe(0);
    expect(hook.result.current.registerFieldErrors.username).toBe(tr.auth.toast.usernameTooShort);
    expect(hook.result.current.registerFieldErrors.password).toBe(tr.auth.passwordHint.min);
    expect(hook.result.current.registerFieldErrors.interests).toBe(tr.auth.register.interestsRequired);

    act(() => {
      hook.result.current.setRegPassword('short');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.registerFieldErrors.password).toBe(tr.auth.passwordHint.min);

    act(() => {
      hook.result.current.setRegPassword('Str0ng#2026');
      hook.result.current.updateRegisterUsername('ab');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.registerFieldErrors.username).toBe(tr.auth.toast.usernameTooShort);

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'unavailable', message: 'username taken' },
    });
    hook.rerender();
    act(() => {
      hook.result.current.updateRegisterUsername('ada');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.registerFieldErrors.username).toBe('username taken');

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'username ok' },
    });
    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'email ok' },
    });
    hook.rerender();
    act(() => {
      hook.result.current.setRegEmail('invalid-email');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.regStep).toBe(1);
    expect(hook.result.current.registerFieldErrors.email).toBe(tr.auth.register.emailInvalid);

    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'unavailable', message: 'email taken' },
    });
    hook.rerender();
    act(() => {
      hook.result.current.setRegEmail('ada@example.com');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.registerFieldErrors.email).toBe('email taken');

    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'email ok' },
    });
    hook.rerender();
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.regStep).toBe(2);
    expect(hook.result.current.registerFieldErrors.interests).toBe(tr.auth.register.interestsRequired);

    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('handles register result errors and thrown failures', async () => {
    const registerMock = vi
      .fn()
      .mockResolvedValueOnce({ success: false, code: 'duplicate_email' })
      .mockResolvedValueOnce({ success: false, code: 'duplicate_username' })
      .mockResolvedValueOnce({ success: false, message: 'custom failure' })
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce('boom');
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: registerMock,
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
    });

    act(() => {
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada');
      hook.result.current.updateRegisterUsername('ada');
      hook.result.current.setRegEmail('ada@example.com');
      hook.result.current.setRegPassword('Str0ng#2026');
      hook.result.current.toggleInterest('coffee');
    });

    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.regStep).toBe(1);
    expect(hook.result.current.registerFieldErrors.email).toBe(tr.auth.register.emailTaken);

    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(hook.result.current.regStep).toBe(0);
    expect(hook.result.current.registerFieldErrors.username).toBe(tr.auth.register.usernameTaken);

    await act(async () => {
      await hook.result.current.handleRegister();
      await hook.result.current.handleRegister();
      await hook.result.current.handleRegister();
    });

    expect(showToastMock).toHaveBeenCalledWith('custom failure', 'error');
    expect(showToastMock).toHaveBeenCalledWith('network down', 'error');
    expect(showToastMock).toHaveBeenCalledWith(tr.auth.toast.duplicateAccount, 'error');
  });

  it('keeps composition-invalid passwords on the password step when continue is pressed', async () => {
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada Lovelace');
      hook.result.current.updateRegisterUsername('ada');
    });

    act(() => {
      hook.result.current.goToNextRegisterStep();
    });

    await waitFor(() => {
      expect(hook.result.current.regStep).toBe(1);
    });

    act(() => {
      hook.result.current.setRegEmail('ada@example.com');
      hook.result.current.setRegPassword('secret123');
    });

    act(() => {
      hook.result.current.goToNextRegisterStep();
    });

    expect(hook.result.current.regStep).toBe(1);
    expect(hook.result.current.canContinue).toBe(false);
    expect(hook.result.current.passwordHint).toBe(tr.auth.passwordHint.complexity);
    expect(hook.result.current.passwordHintTone).toBe('danger');
  });

  it('keeps weak-but-compliant passwords on the password step when continue is pressed', async () => {
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada Lovelace');
      hook.result.current.updateRegisterUsername('ada');
    });

    act(() => {
      hook.result.current.goToNextRegisterStep();
    });

    await waitFor(() => {
      expect(hook.result.current.regStep).toBe(1);
    });

    act(() => {
      hook.result.current.setRegEmail('ada@example.com');
      hook.result.current.setRegPassword('Secret#2026');
    });

    act(() => {
      hook.result.current.goToNextRegisterStep();
    });

    expect(hook.result.current.regStep).toBe(1);
    expect(hook.result.current.canContinue).toBe(false);
    expect(hook.result.current.passwordHint).toBe(tr.auth.register.passwordWeak);
    expect(hook.result.current.passwordHintTone).toBe('danger');
  });

  it('requires successful availability checks before register steps can continue', async () => {
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada Lovelace');
      hook.result.current.updateRegisterUsername('ada');
    });

    expect(hook.result.current.canContinue).toBe(true);

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'checking', message: 'username checking' },
    });
    hook.rerender();
    expect(hook.result.current.canContinue).toBe(false);

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'error', message: 'username error' },
    });
    hook.rerender();
    expect(hook.result.current.canContinue).toBe(false);

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'username ok' },
    });
    hook.rerender();

    act(() => {
      hook.result.current.goToNextRegisterStep();
      hook.result.current.setRegEmail('ada@example.com');
      hook.result.current.setRegPassword('Str0ng#2026');
    });

    expect(hook.result.current.regStep).toBe(1);
    expect(hook.result.current.canContinue).toBe(true);

    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'checking', message: 'email checking' },
    });
    hook.rerender();
    expect(hook.result.current.canContinue).toBe(false);

    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'error', message: 'email error' },
    });
    hook.rerender();
    expect(hook.result.current.canContinue).toBe(false);
  });

  it('returns to the password step when the backend marks the password as weak', async () => {
    const registerMock = vi.fn().mockResolvedValue({
      success: false,
      code: 'weak_password',
      message: 'Password is known to be weak and easy to guess, please choose a different one.',
    });
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: registerMock,
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada');
      hook.result.current.updateRegisterUsername('ada');
    });

    act(() => {
      hook.result.current.goToNextRegisterStep();
      hook.result.current.setRegEmail('ada@example.com');
      hook.result.current.setRegPassword('Str0ng#2026');
    });

    act(() => {
      hook.result.current.goToNextRegisterStep();
      hook.result.current.toggleInterest('coffee');
    });

    act(() => {
      hook.result.current.goToNextRegisterStep();
      hook.result.current.goToNextRegisterStep();
    });

    expect(hook.result.current.regStep).toBe(3);

    await act(async () => {
      await hook.result.current.handleRegister();
    });

    expect(hook.result.current.regStep).toBe(1);
    expect(hook.result.current.passwordHint).toBe(
      'Bu şifre çok zayıf veya kolay tahmin edilebilir. Lütfen farklı bir şifre seç.',
    );
    expect(hook.result.current.passwordHintTone).toBe('danger');
    expect(showToastMock).not.toHaveBeenCalledWith(
      'Password is known to be weak and easy to guess, please choose a different one.',
      'error',
    );
  });

  it('handles resend confirmation empty, failure, and thrown paths', async () => {
    const loginMock = vi.fn().mockResolvedValue({ success: false, code: 'email_not_confirmed' });
    const resendMock = vi
      .fn()
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce(new Error('smtp down'));
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: loginMock,
        register: vi.fn(),
        resendConfirmationEmail: resendMock,
      }),
    );

    await act(async () => {
      await hook.result.current.handleResendConfirmation();
    });

    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.setLoginEmail('user@example.com');
      hook.result.current.setLoginPassword('secret123');
    });
    await act(async () => {
      await hook.result.current.handleLogin();
    });

    await act(async () => {
      await hook.result.current.handleResendConfirmation();
      await hook.result.current.handleResendConfirmation();
    });

    expect(resendMock).toHaveBeenCalledTimes(2);
  });

  it('handles optional media selection and clearing', async () => {
    pickSingleImageMock.mockResolvedValueOnce(null).mockResolvedValueOnce('file://cover.jpg');
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.toggleLegalConsent();
    });

    act(() => {
      hook.result.current.openRegister();
    });
    await act(async () => {
      await hook.result.current.selectProfilePhoto();
      await hook.result.current.selectCoverPhoto();
    });

    expect(hook.result.current.profilePhoto).toBeUndefined();
    expect(hook.result.current.coverPhoto).toBe('file://cover.jpg');

    act(() => {
      hook.result.current.clearProfilePhoto();
      hook.result.current.clearCoverPhoto();
    });

    expect(hook.result.current.profilePhoto).toBeUndefined();
    expect(hook.result.current.coverPhoto).toBeUndefined();
  });

  it('allows existing-user login while registration still requires terms acceptance', async () => {
    const loginMock = vi.fn().mockResolvedValue({ success: true });
    const registerMock = vi.fn();
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: loginMock,
        register: registerMock,
        resendConfirmationEmail: vi.fn(),
      }),
    );

    act(() => {
      hook.result.current.setLoginEmail('user@example.com');
      hook.result.current.setLoginPassword('secret123');
    });

    await act(async () => {
      await hook.result.current.handleLogin();
      await hook.result.current.handleRegister();
    });

    expect(loginMock).toHaveBeenCalledWith('user@example.com', 'secret123');
    expect(registerMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(
      tr.auth.legal.consentRequired,
      'error',
    );
  });

  it('restores persisted legal consent and keeps it synced when toggled', async () => {
    getPersistedLegalConsentVersionMock.mockResolvedValue('2026-08-17-terms-community');
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() =>
      hooks.useAuthScreenState({
        login: vi.fn(),
        register: vi.fn(),
        resendConfirmationEmail: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(hook.result.current.hasAcceptedLegal).toBe(true);

    act(() => {
      hook.result.current.toggleLegalConsent();
    });

    expect(savePersistedLegalConsentVersionMock).toHaveBeenCalledWith(null);
    expect(hook.result.current.hasAcceptedLegal).toBe(false);

    act(() => {
      hook.result.current.toggleLegalConsent();
    });

    expect(savePersistedLegalConsentVersionMock).toHaveBeenCalledWith('2026-08-17-terms-community');
    expect(hook.result.current.hasAcceptedLegal).toBe(true);
  });

  it('reacts to initial route updates and validates availability adapters at their boundary', async () => {
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    let initialEmail: string | undefined;
    let initialView: 'landing' | 'forgotPassword' | undefined;
    const hook = renderHook(() => hooks.useAuthScreenState({
      initialEmail,
      initialView,
      login: vi.fn(),
      register: vi.fn(),
      resendConfirmationEmail: vi.fn(),
    }));
    const usernameOptions = useUsernameAvailabilityQueryMock.mock.calls.at(-1)?.[0] as {
      invalidMessage: (value: string) => string | null;
    };
    const emailOptions = useEmailAvailabilityQueryMock.mock.calls.at(-1)?.[0] as {
      invalidMessage: (value: string) => string | null;
    };
    expect(usernameOptions.invalidMessage('ab')).toBe(tr.auth.toast.usernameTooShort);
    expect(usernameOptions.invalidMessage('valid')).toBeNull();
    expect(emailOptions.invalidMessage('invalid')).toBe(tr.auth.register.emailInvalid);
    expect(emailOptions.invalidMessage('valid@example.com')).toBeNull();

    initialEmail = '  User@Example.COM  ';
    initialView = 'forgotPassword';
    hook.rerender();
    expect(hook.result.current.view).toBe('forgotPassword');
    expect(hook.result.current.loginEmail).toBe('  User@Example.COM  ');
    expect(hook.result.current.forgotPasswordEmail).toBe('  User@Example.COM  ');

    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.setForgotPasswordEmail('');
    });
    await act(async () => {
      await hook.result.current.handleForgotPassword();
    });
    expect(showToastMock).toHaveBeenCalledWith(tr.auth.forgotPassword.missingEmail, 'error');

    act(() => {
      hook.result.current.setForgotPasswordEmail('reset@example.com');
    });
    await act(async () => {
      await hook.result.current.handleForgotPassword();
    });
    expect(showToastMock).toHaveBeenCalledWith(tr.settings.password.resetHint, 'error');
  });

  it('covers forgot-password result variants and thrown weak-password registration', async () => {
    const requestPasswordResetEmail = vi.fn()
      .mockResolvedValueOnce({ success: false, message: 'custom reset failure' })
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce('reset unavailable');
    const register = vi.fn().mockRejectedValue(new Error('Weak password'));
    const hooks = await import('@/mobile/app/features/auth/application/useAuthScreenState');
    const hook = renderHook(() => hooks.useAuthScreenState({
      login: vi.fn(), register, requestPasswordResetEmail, resendConfirmationEmail: vi.fn(),
    }));
    act(() => {
      hook.result.current.toggleLegalConsent();
      hook.result.current.setForgotPasswordEmail('reset@example.com');
    });
    await act(async () => {
      await hook.result.current.handleForgotPassword();
      await hook.result.current.handleForgotPassword();
    });
    expect(hook.result.current.view).toBe('login');
    await act(async () => {
      await hook.result.current.handleForgotPassword();
    });
    expect(showToastMock).toHaveBeenCalledWith(tr.settings.password.resetHint, 'error');

    act(() => {
      hook.result.current.openRegister();
      hook.result.current.setRegName('Ada');
      hook.result.current.updateRegisterUsername('ada');
      hook.result.current.setRegEmail('ada@example.com');
      hook.result.current.setRegPassword('Str0ng#2026');
      hook.result.current.toggleInterest('coffee');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });
    expect(register).toHaveBeenCalledOnce();
    expect(hook.result.current.regStep).toBe(1);
    expect(hook.result.current.passwordHintTone).toBe('danger');

    act(() => {
      hook.result.current.setRegPassword('Qz7!Lm2@');
      hook.result.current.goToPreviousRegisterStep();
      hook.result.current.handleRegisterBack();
    });
    expect(hook.result.current.passwordHint).toBe(tr.auth.passwordHint.good);
  });
});
