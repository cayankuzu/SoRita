import type { AuthActionCode } from '@/mobile/app/app-shell/auth/authTypes';
import type {
  AvailabilityState,
  AvailabilityStatus,
} from '@/mobile/app/data/hooks/useAccountAvailabilityQuery';
import type { AuthPasswordRequirementId } from '@/mobile/app/features/auth/application/authPasswordRequirements';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { PASSWORD_MIN_LENGTH } from '@/mobile/app/shared/validation/contentLimits';
import {
  doesPasswordMeetCompositionRequirements,
  isPasswordLikelyWeak,
} from '@/mobile/app/shared/validation/passwordStrength';

export const AUTH_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthHelperTone = 'muted' | 'danger' | 'success';
type RegisterFieldErrorKey = 'email' | 'name' | 'password' | 'username';
export type RegisterFieldErrors = Partial<Record<RegisterFieldErrorKey, string>>;

export function getPasswordRequirementLabel(requirementId: AuthPasswordRequirementId) {
  return tr.auth.passwordHint.requirementLabels[requirementId];
}

export function getSafeAuthFailureMessage(
  code: AuthActionCode | undefined,
  fallback: string,
) {
  if (code === 'account_locked') {
    return tr.auth.toast.accountLocked;
  }

  if (code === 'rate_limited') {
    return tr.auth.toast.rateLimited;
  }

  return fallback;
}

export function isAvailabilityUsable(status: AvailabilityStatus) {
  return status === 'available';
}

export function getAvailabilityHelper(
  availability: AvailabilityState,
  idleMessage?: string,
) {
  return availability.status === 'idle' ? idleMessage : availability.message;
}

export function getAvailabilityHelperTone(
  availability: AvailabilityState,
): AuthHelperTone {
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

export function isWeakPasswordMessage(message?: string | null) {
  const normalized = message?.toLowerCase() ?? '';

  return (
    normalized.includes('password is known to be weak') ||
    normalized.includes('weak and easy to guess') ||
    normalized.includes('weak password')
  );
}

export function getRegisterPasswordErrorMessage(params: {
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
