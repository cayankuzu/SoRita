import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import {
  useEmailAvailabilityQuery,
  useUsernameAvailabilityQuery,
  type AvailabilityState,
  type AvailabilityStatus,
} from '@/mobile/app/data/hooks/useAccountAvailabilityQuery';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { pickSingleImage } from '@/mobile/app/platform/media/images';
import {
  getPersistedLegalConsentVersion,
  savePersistedLegalConsentVersion,
} from '@/mobile/app/platform/storage/legalConsent';
import {
  LEGAL_CONSENT_VERSION,
  type LegalDocumentId,
} from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { tr } from '@/mobile/app/shared/i18n/tr';

export type AuthView = 'landing' | 'login' | 'register' | 'forgotPassword';

type UseAuthScreenStateParams = Pick<
  AuthContextType,
  'login' | 'register' | 'resendConfirmationEmail'
> &
Partial<
  Pick<AuthContextType, 'requestPasswordResetEmail'>
> & {
  initialEmail?: string;
  initialView?: AuthView;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type HelperTone = 'muted' | 'danger' | 'success';

function isAvailabilityBlocking(status: AvailabilityStatus) {
  return status === 'invalid' || status === 'unavailable';
}

function getAvailabilityHelper(availability: AvailabilityState, idleMessage?: string) {
  return availability.status === 'idle' ? idleMessage : availability.message;
}

function getAvailabilityHelperTone(availability: AvailabilityState): HelperTone {
  if (availability.status === 'available') {
    return 'success';
  }

  if (
    availability.status === 'invalid' ||
    availability.status === 'unavailable' ||
    availability.status === 'error'
  ) {
    return 'danger';
  }

  return 'muted';
}

export function useAuthScreenState({
  initialEmail,
  initialView,
  login,
  register,
  requestPasswordResetEmail = async () => ({ success: false, code: 'unexpected' }),
  resendConfirmationEmail,
}: UseAuthScreenStateParams) {
  const [view, setView] = useState<AuthView>(initialView ?? 'landing');
  const [loginEmail, setLoginEmail] = useState(initialEmail ?? '');
  const [loginPassword, setLoginPassword] = useState('');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState(initialEmail ?? '');
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
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [activeLegalDocument, setActiveLegalDocument] = useState<LegalDocumentId | null>(null);

  useEffect(() => {
    let active = true;

    void getPersistedLegalConsentVersion()
      .then((version) => {
        if (active && version === LEGAL_CONSENT_VERSION) {
          setHasAcceptedLegal(true);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }

    if (initialEmail) {
      setLoginEmail(initialEmail);
      setForgotPasswordEmail(initialEmail);
    }
  }, [initialEmail, initialView]);

  const requireLegalConsent = useCallback(() => {
    if (hasAcceptedLegal) {
      return true;
    }

    showToast(
      'Devam etmek icin Kullanim Kosullari, Topluluk Kurallari, Gizlilik ve KVKK onayini vermelisin.',
      'error',
    );
    return false;
  }, [hasAcceptedLegal]);

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

  const { availability: usernameAvailability } =
    useUsernameAvailabilityQuery({
      active: view === 'register',
      value: regUsername,
      invalidMessage: (value) =>
        value.length < 3 ? 'Kullanici adi en az 3 karakter olmali' : null,
      checkingMessage: 'Kullanici adi kontrol ediliyor...',
      availableMessage: 'Bu kullanici adi kullanilabilir',
      unavailableMessage: 'Bu kullanici adi zaten kullaniliyor',
      errorMessage: 'Kullanici adi su an kontrol edilemiyor',
    });

  const { availability: emailAvailability } =
    useEmailAvailabilityQuery({
      active: view === 'register',
      value: regEmail,
      invalidMessage: (value) => (!EMAIL_REGEX.test(value) ? 'Gecerli bir e-posta gir' : null),
      checkingMessage: 'E-posta kontrol ediliyor...',
      availableMessage: 'Bu e-posta kullanilabilir',
      unavailableMessage: 'Bu e-posta zaten kullaniliyor',
      errorMessage: 'E-posta su an kontrol edilemiyor',
    });

  const usernameHelper = getAvailabilityHelper(usernameAvailability, tr.auth.register.usernameHelper);
  const usernameHelperTone = getAvailabilityHelperTone(usernameAvailability);
  const emailHelper = getAvailabilityHelper(emailAvailability);
  const emailHelperTone = getAvailabilityHelperTone(emailAvailability);

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
    if (!requireLegalConsent()) {
      return;
    }

    resetRegisterState();
    setView('register');
  }, [requireLegalConsent, resetRegisterState]);

  const goToLanding = useCallback(() => {
    setView('landing');
  }, []);

  const goToLogin = useCallback(() => {
    if (!requireLegalConsent()) {
      return;
    }

    setView('login');
  }, [requireLegalConsent]);

  const goToForgotPassword = useCallback(() => {
    if (!requireLegalConsent()) {
      return;
    }

    setForgotPasswordEmail((current) => current || loginEmail);
    setView('forgotPassword');
  }, [loginEmail, requireLegalConsent]);

  const handleLogin = useCallback(async () => {
    if (!requireLegalConsent()) {
      return;
    }

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
  }, [login, loginEmail, loginPassword, requireLegalConsent]);

  const handleRegister = useCallback(async () => {
    if (!requireLegalConsent()) {
      return;
    }

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
        legalConsent: {
          acceptedAt: new Date().toISOString(),
          documentsAccepted: ['terms', 'community', 'privacy', 'kvkk'],
          version: LEGAL_CONSENT_VERSION,
        },
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
    requireLegalConsent,
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

  const handleForgotPassword = useCallback(async () => {
    if (!forgotPasswordEmail.trim()) {
      showToast('Sifirlama maili icin e-posta adresini gir', 'error');
      return;
    }

    try {
      const result = await requestPasswordResetEmail(forgotPasswordEmail);

      if (!result.success) {
        showToast(result.message || tr.settings.password.resetHint, 'error');
        return;
      }

      setLoginEmail(forgotPasswordEmail.trim());
      setView('login');
      showToast(tr.settings.password.resetSent, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.settings.password.resetHint, 'error');
    }
  }, [forgotPasswordEmail, requestPasswordResetEmail]);

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
    if (!requireLegalConsent()) {
      return;
    }

    if (!canContinue) {
      return;
    }

    setRegStep((value) => value + 1);
  }, [canContinue, requireLegalConsent]);

  const toggleLegalConsent = useCallback(() => {
    setHasAcceptedLegal((current) => {
      const nextValue = !current;
      void savePersistedLegalConsentVersion(nextValue ? LEGAL_CONSENT_VERSION : null);
      return nextValue;
    });
  }, []);

  const openLegalDocument = useCallback((documentId: LegalDocumentId) => {
    setActiveLegalDocument(documentId);
  }, []);

  const closeLegalDocument = useCallback(() => {
    setActiveLegalDocument(null);
  }, []);

  return {
    activeLegalDocument,
    canContinue,
    clearCoverPhoto,
    clearProfilePhoto,
    closeLegalDocument,
    confirmationEmail,
    coverPhoto,
    emailHelper,
    emailHelperTone,
    forgotPasswordEmail,
    goToLanding,
    goToForgotPassword,
    goToLogin,
    goToNextRegisterStep,
    goToPreviousRegisterStep,
    handleLogin,
    handleForgotPassword,
    handleRegister,
    handleRegisterBack,
    handleResendConfirmation,
    hasAcceptedLegal,
    loginEmail,
    loginPassword,
    openLegalDocument,
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
    setForgotPasswordEmail,
    setRegBio,
    setRegEmail,
    setRegName,
    setRegPassword,
    setRegPasswordConfirm,
    toggleLegalConsent,
    toggleInterest,
    updateRegisterUsername,
    usernameHelper,
    usernameHelperTone,
    view,
  };
}
