import { tr } from '@/mobile/app/shared/i18n/tr';
import { PASSWORD_MIN_LENGTH } from '@/mobile/app/shared/validation/contentLimits';
import {
  doesPasswordMeetCompositionRequirements,
  isPasswordLikelyWeak,
} from '@/mobile/app/shared/validation/passwordStrength';

export type ResetPasswordValidationResult = {
  confirmError: string;
  passwordError: string;
};

export function validateResetPasswordInput(
  password: string,
  passwordConfirm: string,
): ResetPasswordValidationResult {
  let passwordError = '';
  let confirmError = '';

  if (password.length < PASSWORD_MIN_LENGTH) {
    passwordError = tr.auth.resetPassword.tooShort;
  } else if (!doesPasswordMeetCompositionRequirements(password)) {
    passwordError = tr.auth.passwordHint.complexity;
  } else if (isPasswordLikelyWeak(password)) {
    passwordError = tr.auth.resetPassword.weak;
  }

  if (!passwordConfirm) {
    confirmError = tr.auth.resetPassword.confirmRequired;
  } else if (password !== passwordConfirm) {
    confirmError = tr.auth.resetPassword.mismatch;
  }

  return { confirmError, passwordError };
}
