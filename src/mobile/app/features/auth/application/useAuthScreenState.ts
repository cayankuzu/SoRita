import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import {
  getAuthPasswordRequirementProgress,
} from '@/mobile/app/features/auth/application/authPasswordRequirements';
import {
  useEmailAvailabilityQuery,
  useUsernameAvailabilityQuery,
} from '@/mobile/app/data/hooks/useAccountAvailabilityQuery';
import {
  AUTH_EMAIL_REGEX,
  getAvailabilityHelper,
  getAvailabilityHelperTone,
  getPasswordRequirementLabel,
  getRegisterPasswordErrorMessage,
  getSafeAuthFailureMessage,
  isAvailabilityUsable,
  isWeakPasswordMessage,
  type AuthHelperTone,
  type RegisterFieldErrors,
} from '@/mobile/app/features/auth/application/authScreenStateHelpers';
import { useAuthRegistrationMedia } from '@/mobile/app/features/auth/application/useAuthRegistrationMedia';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import {
  getPersistedLegalConsentVersion,
  savePersistedLegalConsentVersion,
} from '@/mobile/app/platform/storage/legalConsent';
import {
  LEGAL_CONSENT_VERSION,
  LEGAL_DOCUMENT_IDS,
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
import { doesPasswordMeetCompositionRequirements } from '@/mobile/app/shared/validation/passwordStrength';

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

const LAST_REGISTER_STEP_INDEX = 3;

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
  const [registerPasswordError, setRegisterPasswordError] = useState<string | null>(null);
  const [registerFieldErrors, setRegisterFieldErrors] = useState<RegisterFieldErrors>({});
  const [registerSubmissionError, setRegisterSubmissionError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [activeLegalDocument, setActiveLegalDocument] = useState<LegalDocumentId | null>(null);
  const clearRegisterSubmissionError = useCallback(() => {
    setRegisterSubmissionError('');
  }, []);
  const {
    clearCoverPhoto,
    clearProfilePhoto,
    coverPhoto,
    profilePhoto,
    resetRegistrationMedia,
    selectCoverPhoto,
    selectProfilePhoto,
  } = useAuthRegistrationMedia({ onMediaChange: clearRegisterSubmissionError });

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
    resetRegistrationMedia();
    setRegisterPasswordError(null);
    setRegisterFieldErrors({});
    setRegisterSubmissionError('');
  }, [resetRegistrationMedia]);

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
      invalidMessage: (value) => (!AUTH_EMAIL_REGEX.test(value) ? tr.auth.register.emailInvalid : null),
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
  const isEmailFormatValid = AUTH_EMAIL_REGEX.test(normalizedRegEmail);
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
  const passwordRequirementProgress = useMemo(
    () => getAuthPasswordRequirementProgress(regPassword),
    [regPassword],
  );

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

    return true;
  }, [
    canUseEmail,
    canUseUsername,
    normalizedRegName,
    passwordMeetsCompositionRequirements,
    regPassword,
    regStep,
    registerPasswordError,
    registerPasswordPolicyError,
  ]);

  const defaultPasswordHint = useMemo(() => {
    if (regPassword.length === 0) {
      return tr.auth.passwordHint.requirements;
    }

    if (registerPasswordPolicyError) {
      return registerPasswordPolicyError;
    }

    const missingRequirements = passwordRequirementProgress.requirements
      .filter((requirement) => !requirement.met)
      .map((requirement) => getPasswordRequirementLabel(requirement.id));

    if (missingRequirements.length > 0) {
      return tr.auth.passwordHint.missingRequirements(missingRequirements.join(', '));
    }

    return tr.auth.passwordHint.requirementsMet;
  }, [passwordRequirementProgress.requirements, regPassword.length, registerPasswordPolicyError]);

  const passwordHint = registerPasswordError || defaultPasswordHint;
  const passwordHintTone: AuthHelperTone = registerPasswordError
    ? 'danger'
    : regPassword.length === 0
      ? 'muted'
      : regPassword.length < PASSWORD_MIN_LENGTH || Boolean(registerPasswordPolicyError)
        ? 'danger'
        : 'success';

  const setRegPassword = useCallback((value: string) => {
    setRegisterPasswordError(null);
    setRegisterFieldErrors((current) => ({ ...current, password: undefined }));
    setRegisterSubmissionError('');
    setRegPasswordState(value);
  }, []);

  const setLoginEmail = useCallback((value: string) => {
    setLoginError('');
    setLoginEmailState(normalizeEmailInput(value));
  }, []);

  const updateLoginPassword = useCallback((value: string) => {
    setLoginError('');
    setLoginPassword(value);
  }, []);

  const setForgotPasswordEmail = useCallback((value: string) => {
    setForgotPasswordError('');
    setForgotPasswordEmailState(normalizeEmailInput(value));
  }, []);

  const setRegName = useCallback((value: string) => {
    setRegisterFieldErrors((current) => ({ ...current, name: undefined }));
    setRegisterSubmissionError('');
    setRegNameState(normalizeUserNameInput(value));
  }, []);

  const setRegBio = useCallback((value: string) => {
    setRegisterSubmissionError('');
    setRegBioState(normalizeUserBioInput(value));
  }, []);

  const setRegEmail = useCallback((value: string) => {
    setRegisterFieldErrors((current) => ({ ...current, email: undefined }));
    setRegisterSubmissionError('');
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

    return errors;
  }, [
    emailAvailability.message,
    emailAvailability.status,
    isEmailFormatValid,
    isUsernameFormatValid,
    normalizedRegName,
    passwordMeetsCompositionRequirements,
    regPassword.length,
    registerPasswordError,
    registerPasswordPolicyError,
    usernameAvailability.message,
    usernameAvailability.status,
  ]);

  const openRegister = useCallback(() => {
    if (!requireLegalConsent()) {
      setView('landing');
      return;
    }

    resetRegisterState();
    setView('register');
  }, [requireLegalConsent, resetRegisterState]);

  const goToLanding = useCallback(() => {
    setView('landing');
  }, []);

  const goToLogin = useCallback(() => {
    setForgotPasswordError('');
    setView('login');
  }, []);

  const goToForgotPassword = useCallback(() => {
    setForgotPasswordError('');
    setForgotPasswordEmailState((current) => current || loginEmail);
    setView('forgotPassword');
  }, [loginEmail]);

  const handleLogin = useCallback(async () => {
    setLoginError('');

    if (!AUTH_EMAIL_REGEX.test(loginEmail.trim()) || !loginPassword) {
      setLoginError(tr.auth.login.missingCredentials);
      showToast(tr.auth.login.missingCredentials, 'error');
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

      const message = getSafeAuthFailureMessage(result.code, tr.auth.toast.loginInvalid, result.retryAfterMs);
      setLoginError(message);
      showToast(message, 'error');
    } catch {
      setLoginError(tr.auth.toast.loginInvalid);
      showToast(tr.auth.toast.loginInvalid, 'error');
    }
  }, [login, loginEmail, loginPassword]);

  const handleRegister = useCallback(async () => {
    if (!requireLegalConsent()) {
      return;
    }

    setRegisterSubmissionError('');
    const allStepErrors = [0, 1].map((step) => validateRegisterStep(step));
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
          documentsAccepted: LEGAL_DOCUMENT_IDS,
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

        const message = getSafeAuthFailureMessage(
          result.code,
          tr.auth.register.registrationFailed,
          result.retryAfterMs,
        );
        setRegisterSubmissionError(message);
        showToast(message, 'error');
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

      setRegisterSubmissionError(tr.auth.register.registrationFailed);
      showToast(tr.auth.register.registrationFailed, 'error');
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
    setForgotPasswordError('');

    if (!normalizedForgotPasswordEmail || !AUTH_EMAIL_REGEX.test(normalizedForgotPasswordEmail)) {
      const message = normalizedForgotPasswordEmail
        ? tr.auth.register.emailInvalid
        : tr.auth.forgotPassword.missingEmail;
      setForgotPasswordError(message);
      showToast(message, 'error');
      return;
    }

    try {
      const result = await requestPasswordResetEmail(normalizedForgotPasswordEmail);

      if (!result.success) {
        const message = getSafeAuthFailureMessage(
          result.code,
          tr.auth.forgotPassword.sendFailed,
          result.retryAfterMs,
        );
        setForgotPasswordError(message);
        showToast(message, 'error');
        return;
      }

      setLoginEmailState(normalizedForgotPasswordEmail);
      setView('login');
      showToast(tr.auth.forgotPassword.sent, 'success');
    } catch {
      setForgotPasswordError(tr.auth.forgotPassword.sendFailed);
      showToast(tr.auth.forgotPassword.sendFailed, 'error');
    }
  }, [forgotPasswordEmail, requestPasswordResetEmail]);

  const toggleInterest = useCallback((value: string) => {
    setRegisterSubmissionError('');
    setRegInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }, []);

  const updateRegisterUsername = useCallback((value: string) => {
    setRegisterFieldErrors((current) => ({ ...current, username: undefined }));
    setRegisterSubmissionError('');
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
    forgotPasswordError,
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
    loginError,
    loginPassword,
    openLegalDocument,
    openRegister,
    passwordHint,
    passwordHintTone,
    profilePhoto,
    registerFieldErrors,
    registerSubmissionError,
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
    setLoginPassword: updateLoginPassword,
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
