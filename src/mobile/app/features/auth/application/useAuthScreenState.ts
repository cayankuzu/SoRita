import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import {
  useEmailAvailabilityQuery,
  useUsernameAvailabilityQuery,
  type AvailabilityState,
  type AvailabilityStatus,
} from '@/mobile/app/data/hooks/useAccountAvailabilityQuery';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { pickSingleImageFromPrompt } from '@/mobile/app/platform/media/images';
import {
  getPersistedLegalConsentVersion,
  savePersistedLegalConsentVersion,
} from '@/mobile/app/platform/storage/legalConsent';
import {
  LEGAL_CONSENT_VERSION,
  type LegalDocumentId,
} from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  normalizeEmailInput,
  normalizeUserBioInput,
  normalizeUserNameInput,
  normalizeUsernameInput,
  PASSWORD_MIN_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';
import {
  doesPasswordMeetCompositionRequirements,
  isPasswordLikelyWeak,
} from '@/mobile/app/shared/validation/passwordStrength';

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
const LAST_REGISTER_STEP_INDEX = 3;
type HelperTone = 'muted' | 'danger' | 'success';
type RegisterFieldErrorKey = 'email' | 'interests' | 'name' | 'password' | 'username';
type RegisterFieldErrors = Partial<Record<RegisterFieldErrorKey, string>>;

function isAvailabilityUsable(status: AvailabilityStatus) {
  return status === 'available';
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

function isWeakPasswordMessage(message?: string | null) {
  const normalized = message?.toLowerCase() ?? '';

  return (
    normalized.includes('password is known to be weak') ||
    normalized.includes('weak and easy to guess') ||
    normalized.includes('weak password')
  );
}

function getRegisterPasswordErrorMessage(params: {
  email: string;
  name: string;
  password: string;
  username: string;
}) {
  if (params.password.length < PASSWORD_MIN_LENGTH) {
    return null;
  }

  if (!doesPasswordMeetCompositionRequirements(params.password)) {
    return tr.auth.passwordHint.complexity;
  }

  if (
    isPasswordLikelyWeak(params.password, {
      email: params.email,
      name: params.name,
      username: params.username,
    })
  ) {
    return tr.auth.register.passwordWeak;
  }

  return null;
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
  const [loginEmail, setLoginEmailState] = useState(normalizeEmailInput(initialEmail ?? ''));
  const [loginPassword, setLoginPassword] = useState('');
  const [forgotPasswordEmail, setForgotPasswordEmailState] = useState(normalizeEmailInput(initialEmail ?? ''));
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [regStep, setRegStep] = useState(0);
  const [regName, setRegNameState] = useState('');
  const [regUsername, setRegUsernameState] = useState('');
  const [regBio, setRegBioState] = useState('');
  const [regEmail, setRegEmailState] = useState('');
  const [regPassword, setRegPasswordState] = useState('');
  const [regInterests, setRegInterests] = useState<string[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>();
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>();
  const [registerPasswordError, setRegisterPasswordError] = useState<string | null>(null);
  const [registerFieldErrors, setRegisterFieldErrors] = useState<RegisterFieldErrors>({});
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
      .catch((err) => { logger.debug('auth', 'Failed to get persisted legal consent version', err); });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }

    if (initialEmail) {
      const normalizedInitialEmail = normalizeEmailInput(initialEmail);
      setLoginEmailState(normalizedInitialEmail);
      setForgotPasswordEmailState(normalizedInitialEmail);
    }
  }, [initialEmail, initialView]);

  const requireLegalConsent = useCallback(() => {
    if (hasAcceptedLegal) {
      return true;
    }

    showToast(tr.auth.legal.consentRequired, 'error');
    return false;
  }, [hasAcceptedLegal]);

  const resetRegisterState = useCallback(() => {
    setRegStep(0);
    setRegNameState('');
    setRegUsernameState('');
    setRegBioState('');
    setRegEmailState('');
    setRegPasswordState('');
    setRegInterests([]);
    setProfilePhoto(undefined);
    setCoverPhoto(undefined);
    setRegisterPasswordError(null);
    setRegisterFieldErrors({});
  }, []);

  const { availability: usernameAvailability } =
    useUsernameAvailabilityQuery({
      active: view === 'register',
      value: regUsername,
      invalidMessage: (value) =>
        value.length < 3 ? tr.auth.toast.usernameTooShort : null,
      checkingMessage: tr.auth.register.usernameChecking,
      availableMessage: tr.auth.register.usernameUsable,
      unavailableMessage: tr.auth.register.usernameTaken,
      errorMessage: tr.auth.register.usernameError,
    });

  const { availability: emailAvailability } =
    useEmailAvailabilityQuery({
      active: view === 'register',
      value: regEmail,
      invalidMessage: (value) => (!EMAIL_REGEX.test(value) ? tr.auth.register.emailInvalid : null),
      checkingMessage: tr.auth.register.emailChecking,
      availableMessage: tr.auth.register.emailUsable,
      unavailableMessage: tr.auth.register.emailTaken,
      errorMessage: tr.auth.register.emailError,
    });

  const usernameHelper = getAvailabilityHelper(usernameAvailability, tr.auth.register.usernameHelper);
  const usernameHelperTone = getAvailabilityHelperTone(usernameAvailability);
  const emailHelper = getAvailabilityHelper(emailAvailability);
  const emailHelperTone = getAvailabilityHelperTone(emailAvailability);

  const normalizedRegName = normalizeUserNameInput(regName).trim();
  const normalizedRegUsername = normalizeUsernameInput(regUsername).trim();
  const normalizedRegBio = normalizeUserBioInput(regBio).trim();
  const normalizedRegEmail = normalizeEmailInput(regEmail).trim().toLowerCase();
  const isUsernameFormatValid = normalizedRegUsername.length >= 3;
  const isEmailFormatValid = EMAIL_REGEX.test(normalizedRegEmail);
  const canUseUsername =
    isUsernameFormatValid && isAvailabilityUsable(usernameAvailability.status);
  const canUseEmail = isEmailFormatValid && isAvailabilityUsable(emailAvailability.status);
  const registerPasswordPolicyError = useMemo(
    () =>
      getRegisterPasswordErrorMessage({
        email: normalizedRegEmail,
        name: normalizedRegName,
        password: regPassword,
        username: normalizedRegUsername,
      }),
    [normalizedRegEmail, normalizedRegName, normalizedRegUsername, regPassword],
  );
  const passwordMeetsCompositionRequirements = doesPasswordMeetCompositionRequirements(regPassword);

  const canContinue = useMemo(() => {
    if (regStep === 0) {
      return normalizedRegName.length >= 2 && canUseUsername;
    }

    if (regStep === 1) {
      return (
        canUseEmail &&
        regPassword.length >= PASSWORD_MIN_LENGTH &&
        passwordMeetsCompositionRequirements &&
        !registerPasswordError &&
        !registerPasswordPolicyError
      );
    }

    if (regStep === 2) {
      return regInterests.length > 0;
    }

    return true;
  }, [
    canUseEmail,
    canUseUsername,
    normalizedRegName,
    passwordMeetsCompositionRequirements,
    regInterests.length,
    regPassword,
    regStep,
    registerPasswordError,
    registerPasswordPolicyError,
  ]);

  const defaultPasswordHint = useMemo(() => {
    if (regPassword.length === 0) {
      return tr.auth.passwordHint.min;
    }

    if (regPassword.length < PASSWORD_MIN_LENGTH) {
      return tr.auth.passwordHint.remaining(PASSWORD_MIN_LENGTH - regPassword.length);
    }

    if (registerPasswordPolicyError) {
      return registerPasswordPolicyError;
    }

    if (regPassword.length < 10) {
      return tr.auth.passwordHint.good;
    }

    return tr.auth.passwordHint.strong;
  }, [regPassword, registerPasswordPolicyError]);

  const passwordHint = registerPasswordError || defaultPasswordHint;
  const passwordHintTone: HelperTone = registerPasswordError
    ? 'danger'
    : regPassword.length === 0
      ? 'muted'
      : regPassword.length < PASSWORD_MIN_LENGTH || Boolean(registerPasswordPolicyError)
        ? 'danger'
        : 'success';

  const setRegPassword = useCallback((value: string) => {
    setRegisterPasswordError(null);
    setRegisterFieldErrors((current) => ({ ...current, password: undefined }));
    setRegPasswordState(value);
  }, []);

  const setLoginEmail = useCallback((value: string) => {
    setLoginEmailState(normalizeEmailInput(value));
  }, []);

  const setForgotPasswordEmail = useCallback((value: string) => {
    setForgotPasswordEmailState(normalizeEmailInput(value));
  }, []);

  const setRegName = useCallback((value: string) => {
    setRegisterFieldErrors((current) => ({ ...current, name: undefined }));
    setRegNameState(normalizeUserNameInput(value));
  }, []);

  const setRegBio = useCallback((value: string) => {
    setRegBioState(normalizeUserBioInput(value));
  }, []);

  const setRegEmail = useCallback((value: string) => {
    setRegisterFieldErrors((current) => ({ ...current, email: undefined }));
    setRegEmailState(normalizeEmailInput(value));
  }, []);

  const focusPasswordStepError = useCallback((message: string = tr.auth.register.passwordWeak) => {
    setRegStep(1);
    setRegisterPasswordError(message);
    setRegisterFieldErrors((current) => ({ ...current, password: message }));
  }, []);

  const validateRegisterStep = useCallback((step: number): RegisterFieldErrors => {
    const errors: RegisterFieldErrors = {};

    if (step === 0) {
      if (normalizedRegName.length < 2) {
        errors.name = tr.auth.register.nameRequired;
      }

      if (!isUsernameFormatValid) {
        errors.username = tr.auth.toast.usernameTooShort;
      } else if (!isAvailabilityUsable(usernameAvailability.status)) {
        errors.username = usernameAvailability.message || tr.auth.register.usernameError;
      }
    }

    if (step === 1) {
      if (!isEmailFormatValid) {
        errors.email = tr.auth.register.emailInvalid;
      } else if (!isAvailabilityUsable(emailAvailability.status)) {
        errors.email = emailAvailability.message || tr.auth.register.emailUnavailable;
      }

      if (regPassword.length < PASSWORD_MIN_LENGTH) {
        errors.password = tr.auth.passwordHint.min;
      } else if (!passwordMeetsCompositionRequirements) {
        errors.password = tr.auth.passwordHint.complexity;
      } else if (registerPasswordPolicyError) {
        errors.password = registerPasswordPolicyError;
      } else if (registerPasswordError) {
        errors.password = registerPasswordError;
      }
    }

    if (step === 2 && regInterests.length === 0) {
      errors.interests = tr.auth.register.interestsRequired;
    }

    return errors;
  }, [
    emailAvailability.message,
    emailAvailability.status,
    isEmailFormatValid,
    isUsernameFormatValid,
    normalizedRegName,
    passwordMeetsCompositionRequirements,
    regInterests.length,
    regPassword.length,
    registerPasswordError,
    registerPasswordPolicyError,
    usernameAvailability.message,
    usernameAvailability.status,
  ]);

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

    setForgotPasswordEmailState((current) => current || loginEmail);
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

      showToast(result.message || tr.auth.toast.loginInvalid, 'error');
    } catch {
      showToast(tr.auth.toast.loginInvalid, 'error');
    }
  }, [login, loginEmail, loginPassword, requireLegalConsent]);

  const handleRegister = useCallback(async () => {
    if (!requireLegalConsent()) {
      return;
    }

    const allStepErrors = [0, 1, 2].map((step) => validateRegisterStep(step));
    const mergedStepErrors = Object.assign({}, ...allStepErrors) as RegisterFieldErrors;

    if (Object.values(mergedStepErrors).some(Boolean)) {
      const firstInvalidStep = allStepErrors.findIndex((errors) =>
        Object.values(errors).some(Boolean),
      );

      setRegisterFieldErrors(mergedStepErrors);
      setRegStep(firstInvalidStep);
      return;
    }

    try {
      const result = await register({
        email: normalizedRegEmail,
        password: regPassword,
        name: normalizedRegName,
        username: normalizedRegUsername,
        bio: normalizedRegBio || undefined,
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
        if (result.code === 'weak_password' || isWeakPasswordMessage(result.message)) {
          focusPasswordStepError();
          return;
        }

        if (result.code === 'duplicate_email') {
          setRegStep(1);
          setRegisterFieldErrors((current) => ({ ...current, email: tr.auth.register.emailTaken }));
          return;
        }

        if (result.code === 'duplicate_username') {
          setRegStep(0);
          setRegisterFieldErrors((current) => ({ ...current, username: tr.auth.register.usernameTaken }));
          return;
        }

        showToast(result.message || tr.auth.toast.duplicateAccount, 'error');
        return;
      }

      setConfirmationEmail(normalizedRegEmail);
      setLoginEmailState(normalizedRegEmail);
      setLoginPassword('');
      resetRegisterState();
      setView('login');
      showToast(tr.auth.toast.confirmationSent, 'success');
    } catch (error) {
      if (error instanceof Error && isWeakPasswordMessage(error.message)) {
        focusPasswordStepError();
        return;
      }

      showToast(error instanceof Error ? error.message : tr.auth.toast.duplicateAccount, 'error');
    }
  }, [
    coverPhoto,
    normalizedRegUsername,
    normalizedRegBio,
    normalizedRegEmail,
    normalizedRegName,
    profilePhoto,
    regInterests,
    regPassword,
    register,
    focusPasswordStepError,
    resetRegisterState,
    requireLegalConsent,
    validateRegisterStep,
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
    const normalizedForgotPasswordEmail = normalizeEmailInput(forgotPasswordEmail).trim().toLowerCase();

    if (!normalizedForgotPasswordEmail) {
      showToast(tr.auth.forgotPassword.missingEmail, 'error');
      return;
    }

    try {
      const result = await requestPasswordResetEmail(normalizedForgotPasswordEmail);

      if (!result.success) {
        showToast(result.message || tr.settings.password.resetHint, 'error');
        return;
      }

      setLoginEmailState(normalizedForgotPasswordEmail);
      setView('login');
      showToast(tr.settings.password.resetSent, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.settings.password.resetHint, 'error');
    }
  }, [forgotPasswordEmail, requestPasswordResetEmail]);

  const toggleInterest = useCallback((value: string) => {
    setRegisterFieldErrors((current) => ({ ...current, interests: undefined }));
    setRegInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }, []);

  const selectProfilePhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({
      cropAspect: [1, 1],
      cropShape: 'oval',
    });

    if (uri) {
      setProfilePhoto(uri);
    }
  }, []);

  const selectCoverPhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({
      cropAspect: [21, 9],
      cropShape: 'rectangle',
    });

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
    setRegisterFieldErrors((current) => ({ ...current, username: undefined }));
    setRegUsernameState(normalizeUsernameInput(value));
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

    const stepErrors = validateRegisterStep(regStep);

    if (Object.values(stepErrors).some(Boolean)) {
      setRegisterFieldErrors((current) => ({ ...current, ...stepErrors }));
      return;
    }

    setRegisterFieldErrors({});
    setRegStep((value) => Math.min(value + 1, LAST_REGISTER_STEP_INDEX));
  }, [regStep, requireLegalConsent, validateRegisterStep]);

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
    emailAvailabilityStatus: emailAvailability.status,
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
    passwordHintTone,
    profilePhoto,
    registerFieldErrors,
    regBio,
    regEmail,
    regInterests,
    regName,
    regPassword,
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
    toggleLegalConsent,
    toggleInterest,
    updateRegisterUsername,
    usernameHelper,
    usernameAvailabilityStatus: usernameAvailability.status,
    usernameHelperTone,
    view,
  };
}
