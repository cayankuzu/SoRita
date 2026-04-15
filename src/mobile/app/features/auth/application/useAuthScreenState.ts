import { useCallback, useMemo, useState } from 'react';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import { checkAccountAvailability } from '@/mobile/app/data/repositories/accountAvailability';
import {
  useAvailabilityCheck,
  type AvailabilityStatus,
} from '@/mobile/app/features/auth/application/useAvailabilityCheck';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { pickSingleImage } from '@/mobile/app/platform/media/images';
import { tr } from '@/mobile/app/shared/i18n/tr';

export type AuthView = 'landing' | 'login' | 'register';

type UseAuthScreenStateParams = Pick<
  AuthContextType,
  'login' | 'register' | 'resendConfirmationEmail'
>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAvailabilityBlocking(status: AvailabilityStatus) {
  return status === 'invalid' || status === 'unavailable';
}

export function useAuthScreenState({
  login,
  register,
  resendConfirmationEmail,
}: UseAuthScreenStateParams) {
  const [view, setView] = useState<AuthView>('landing');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [regStep, setRegStep] = useState(0);
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regInterests, setRegInterests] = useState<string[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>();
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>();

  const resetRegisterState = useCallback(() => {
    setRegStep(0);
    setRegName('');
    setRegUsername('');
    setRegBio('');
    setRegEmail('');
    setRegPassword('');
    setRegPasswordConfirm('');
    setRegInterests([]);
    setProfilePhoto(undefined);
    setCoverPhoto(undefined);
  }, []);

  const { availability: usernameAvailability, helper: usernameHelper, helperTone: usernameHelperTone } =
    useAvailabilityCheck({
      active: view === 'register',
      value: regUsername,
      idleMessage: tr.auth.register.usernameHelper,
      invalidMessage: (value) =>
        value.length < 3 ? 'Kullanici adi en az 3 karakter olmali' : null,
      checkingMessage: 'Kullanici adi kontrol ediliyor...',
      availableMessage: 'Bu kullanici adi kullanilabilir',
      unavailableMessage: 'Bu kullanici adi zaten kullaniliyor',
      errorMessage: 'Kullanici adi su an kontrol edilemiyor',
      checkAvailability: async (username) => {
        const result = await checkAccountAvailability({ username });
        return result.usernameAvailable;
      },
    });

  const { availability: emailAvailability, helper: emailHelper, helperTone: emailHelperTone } =
    useAvailabilityCheck({
      active: view === 'register',
      value: regEmail,
      invalidMessage: (value) => (!EMAIL_REGEX.test(value) ? 'Gecerli bir e-posta gir' : null),
      checkingMessage: 'E-posta kontrol ediliyor...',
      availableMessage: 'Bu e-posta kullanilabilir',
      unavailableMessage: 'Bu e-posta zaten kullaniliyor',
      errorMessage: 'E-posta su an kontrol edilemiyor',
      checkAvailability: async (email) => {
        const result = await checkAccountAvailability({ email });
        return result.emailAvailable;
      },
    });

  const normalizedRegUsername = regUsername.trim().toLowerCase();
  const normalizedRegEmail = regEmail.trim().toLowerCase();
  const isUsernameFormatValid = normalizedRegUsername.length >= 3;
  const isEmailFormatValid = EMAIL_REGEX.test(normalizedRegEmail);
  const canUseUsername =
    isUsernameFormatValid && !isAvailabilityBlocking(usernameAvailability.status);
  const canUseEmail = isEmailFormatValid && !isAvailabilityBlocking(emailAvailability.status);

  const canContinue = useMemo(() => {
    if (regStep === 0) {
      return regName.trim().length >= 2 && canUseUsername;
    }

    if (regStep === 1) {
      return (
        canUseEmail &&
        regPassword.length >= 6 &&
        regPassword === regPasswordConfirm
      );
    }

    if (regStep === 2) {
      return regInterests.length > 0;
    }

    return true;
  }, [
    canUseEmail,
    canUseUsername,
    regInterests.length,
    regName,
    regPassword,
    regPasswordConfirm,
    regStep,
  ]);

  const passwordHint = useMemo(() => {
    if (regPassword.length === 0) {
      return tr.auth.passwordHint.min;
    }

    if (regPassword.length < 6) {
      return tr.auth.passwordHint.remaining(6 - regPassword.length);
    }

    if (regPassword.length < 10) {
      return tr.auth.passwordHint.good;
    }

    return tr.auth.passwordHint.strong;
  }, [regPassword]);

  const openRegister = useCallback(() => {
    resetRegisterState();
    setView('register');
  }, [resetRegisterState]);

  const goToLanding = useCallback(() => {
    setView('landing');
  }, []);

  const goToLogin = useCallback(() => {
    setView('login');
  }, []);

  const handleLogin = useCallback(async () => {
    try {
      const result = await login(loginEmail, loginPassword);

      if (result.success) {
        setConfirmationEmail('');
        showToast(tr.auth.toast.loginSuccess, 'success');
        return;
      }

      if (result.code === 'email_not_confirmed') {
        setConfirmationEmail(loginEmail.trim());
        showToast(tr.auth.toast.emailNotConfirmed, 'error');
        return;
      }

      showToast(tr.auth.toast.loginInvalid, 'error');
    } catch {
      showToast(tr.auth.toast.loginInvalid, 'error');
    }
  }, [login, loginEmail, loginPassword]);

  const handleRegister = useCallback(async () => {
    if (regPassword !== regPasswordConfirm) {
      showToast(tr.auth.toast.passwordMismatch, 'error');
      return;
    }

    if (regPassword.length < 6) {
      showToast(tr.auth.toast.passwordTooShort, 'error');
      return;
    }

    if (!isUsernameFormatValid) {
      showToast(tr.auth.toast.usernameTooShort, 'error');
      return;
    }

    if (usernameAvailability.status === 'unavailable') {
      showToast('Bu kullanici adi zaten kullaniliyor', 'error');
      return;
    }

    if (!isEmailFormatValid) {
      showToast('Gecerli bir e-posta gir', 'error');
      return;
    }

    if (emailAvailability.status === 'unavailable') {
      showToast('Once gecerli ve benzersiz bir e-posta gir', 'error');
      return;
    }

    if (regInterests.length === 0) {
      showToast('En az bir ilgi alani sec', 'error');
      return;
    }

    try {
      const result = await register({
        email: regEmail,
        password: regPassword,
        name: regName,
        username: normalizedRegUsername,
        bio: regBio,
        interests: regInterests,
        profilePhoto,
        coverPhoto,
      });

      if (!result.success) {
        if (result.code === 'duplicate_email') {
          showToast('Bu e-posta zaten kullaniliyor', 'error');
          return;
        }

        if (result.code === 'duplicate_username') {
          showToast('Bu kullanici adi zaten kullaniliyor', 'error');
          return;
        }

        showToast(result.message || tr.auth.toast.duplicateAccount, 'error');
        return;
      }

      setConfirmationEmail(regEmail.trim());
      setLoginEmail(regEmail.trim());
      setLoginPassword('');
      resetRegisterState();
      setView('login');
      showToast(tr.auth.toast.confirmationSent, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.auth.toast.duplicateAccount, 'error');
    }
  }, [
    coverPhoto,
    emailAvailability.status,
    isEmailFormatValid,
    isUsernameFormatValid,
    normalizedRegUsername,
    profilePhoto,
    regBio,
    regEmail,
    regInterests,
    regName,
    regPassword,
    regPasswordConfirm,
    regUsername,
    register,
    resetRegisterState,
    usernameAvailability.status,
  ]);

  const handleResendConfirmation = useCallback(async () => {
    if (!confirmationEmail.trim()) {
      return;
    }

    try {
      const result = await resendConfirmationEmail(confirmationEmail);

      if (!result.success) {
        showToast(tr.auth.toast.confirmationResendError, 'error');
        return;
      }

      showToast(tr.auth.toast.confirmationResent, 'success');
    } catch {
      showToast(tr.auth.toast.confirmationResendError, 'error');
    }
  }, [confirmationEmail, resendConfirmationEmail]);

  const toggleInterest = useCallback((value: string) => {
    setRegInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }, []);

  const selectProfilePhoto = useCallback(async () => {
    const uri = await pickSingleImage();

    if (uri) {
      setProfilePhoto(uri);
    }
  }, []);

  const selectCoverPhoto = useCallback(async () => {
    const uri = await pickSingleImage();

    if (uri) {
      setCoverPhoto(uri);
    }
  }, []);

  const clearProfilePhoto = useCallback(() => {
    setProfilePhoto(undefined);
  }, []);

  const clearCoverPhoto = useCallback(() => {
    setCoverPhoto(undefined);
  }, []);

  const updateRegisterUsername = useCallback((value: string) => {
    setRegUsername(value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
  }, []);

  const goToPreviousRegisterStep = useCallback(() => {
    setRegStep((value) => Math.max(0, value - 1));
  }, []);

  const handleRegisterBack = useCallback(() => {
    if (regStep === 0) {
      setView('landing');
      return;
    }

    setRegStep((value) => value - 1);
  }, [regStep]);

  const goToNextRegisterStep = useCallback(() => {
    if (!canContinue) {
      return;
    }

    setRegStep((value) => value + 1);
  }, [canContinue]);

  return {
    canContinue,
    clearCoverPhoto,
    clearProfilePhoto,
    confirmationEmail,
    coverPhoto,
    emailHelper,
    emailHelperTone,
    goToLanding,
    goToLogin,
    goToNextRegisterStep,
    goToPreviousRegisterStep,
    handleLogin,
    handleRegister,
    handleRegisterBack,
    handleResendConfirmation,
    loginEmail,
    loginPassword,
    openRegister,
    passwordHint,
    profilePhoto,
    regBio,
    regEmail,
    regInterests,
    regName,
    regPassword,
    regPasswordConfirm,
    regStep,
    regUsername,
    selectCoverPhoto,
    selectProfilePhoto,
    setLoginEmail,
    setLoginPassword,
    setRegBio,
    setRegEmail,
    setRegName,
    setRegPassword,
    setRegPasswordConfirm,
    toggleInterest,
    updateRegisterUsername,
    usernameHelper,
    usernameHelperTone,
    view,
  };
}
