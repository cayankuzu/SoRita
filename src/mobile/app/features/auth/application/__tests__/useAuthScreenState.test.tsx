import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

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
  pickSingleImage: pickSingleImageMock,
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
      hook.result.current.toggleLegalConsent();
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

    expect(hook.result.current.view).toBe('landing');
    expect(showToastMock).toHaveBeenCalledWith(
      'Devam etmek icin Kullanim Kosullari, Topluluk Kurallari, Gizlilik ve KVKK onayini vermelisin.',
      'error',
    );

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
      hook.result.current.setRegPassword('secret123');
      hook.result.current.setRegPasswordConfirm('secret123');
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
        documentsAccepted: ['terms', 'community', 'privacy', 'kvkk'],
        version: '2026-04-16',
      },
      name: 'Ada Lovelace',
      password: 'secret123',
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
      hook.result.current.setRegPasswordConfirm('different');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });

    act(() => {
      hook.result.current.setRegPassword('short');
      hook.result.current.setRegPasswordConfirm('short');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });

    act(() => {
      hook.result.current.setRegPassword('secret123');
      hook.result.current.setRegPasswordConfirm('secret123');
      hook.result.current.updateRegisterUsername('ab');
    });
    await act(async () => {
      await hook.result.current.handleRegister();
    });

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

    useEmailAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'email ok' },
    });
    hook.rerender();
    await act(async () => {
      await hook.result.current.handleRegister();
    });

    expect(showToastMock).toHaveBeenCalledTimes(7);
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
      hook.result.current.setRegPassword('secret123');
      hook.result.current.setRegPasswordConfirm('secret123');
      hook.result.current.toggleInterest('coffee');
    });

    await act(async () => {
      await hook.result.current.handleRegister();
      await hook.result.current.handleRegister();
      await hook.result.current.handleRegister();
      await hook.result.current.handleRegister();
      await hook.result.current.handleRegister();
    });

    expect(showToastMock).toHaveBeenCalledWith('Bu e-posta zaten kullaniliyor', 'error');
    expect(showToastMock).toHaveBeenCalledWith('Bu kullanici adi zaten kullaniliyor', 'error');
    expect(showToastMock).toHaveBeenCalledWith('custom failure', 'error');
    expect(showToastMock).toHaveBeenCalledWith('network down', 'error');
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

  it('blocks login and registration flows until legal consent is accepted', async () => {
    const loginMock = vi.fn();
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

    expect(loginMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(
      'Devam etmek icin Kullanim Kosullari, Topluluk Kurallari, Gizlilik ve KVKK onayini vermelisin.',
      'error',
    );
  });

  it('restores persisted legal consent and keeps it synced when toggled', async () => {
    getPersistedLegalConsentVersionMock.mockResolvedValue('2026-04-16');
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

    expect(savePersistedLegalConsentVersionMock).toHaveBeenCalledWith('2026-04-16');
    expect(hook.result.current.hasAcceptedLegal).toBe(true);
  });
});
