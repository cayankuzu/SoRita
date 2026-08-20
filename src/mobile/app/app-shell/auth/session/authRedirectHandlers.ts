import type { Session } from '@supabase/supabase-js';

import {
  clearCurrentUserState,
  persistAuthSession,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import {
  clearPendingAuthRedirectStates,
  consumePendingAuthRedirectState,
  discardPendingAuthRedirectState,
  type AuthRedirectParams,
} from '@/mobile/app/app-shell/auth/session/authRedirectState';
import { runWithPasswordRecoverySessionExchange } from '@/mobile/app/app-shell/auth/session/passwordRecoverySessionGuard';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';

async function clearRejectedAuthPayload() {
  await persistAuthSession(null);
  await clearPendingAuthRedirectStates();
  await supabase.auth.signOut().catch((err) => { logger.debug('auth', 'Failed to sign out while clearing rejected auth payload', err); });
  clearCurrentUserState();
}

async function failAuthRedirect(message: string): Promise<never> {
  await clearRejectedAuthPayload();
  throw new Error(message);
}

async function failPasswordResetRedirect(
  payload: AuthRedirectParams,
  message: string,
): Promise<never> {
  await discardPendingAuthRedirectState(payload.state);
  throw new Error(message);
}

async function resolveSessionFromPayload(
  payload: AuthRedirectParams,
  fail: (message: string) => Promise<never> = failAuthRedirect,
): Promise<Session> {
  if (payload.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(payload.code);

    if (error || !data.session) {
      return fail(error?.message || tr.auth.callback.sessionValidationFailed);
    }

    return data.session;
  }

  return fail(tr.auth.callback.missingCode);
}

function hasProviderError(payload: AuthRedirectParams) {
  return Boolean(payload.error || payload.errorCode);
}

export async function completeSignupRedirect(payload: AuthRedirectParams) {
  if (hasProviderError(payload)) {
    await failAuthRedirect(tr.auth.callback.signupLinkInvalid);
  }

  const validation = await consumePendingAuthRedirectState({
    flow: payload.flow,
    state: payload.state,
    target: payload.target,
  });

  if (!validation.success || payload.flow !== 'signup') {
    await failAuthRedirect(tr.auth.callback.signupLinkInvalid);
  }

  const session = await resolveSessionFromPayload(payload);
  await persistAuthSession(session);
}

export async function preparePasswordResetRedirect(payload: AuthRedirectParams) {
  if (hasProviderError(payload)) {
    await failPasswordResetRedirect(payload, tr.auth.callback.passwordResetLinkInvalid);
  }

  const validation = await consumePendingAuthRedirectState({
    flow: payload.flow,
    state: payload.state,
    target: payload.target,
  });

  if (!validation.success || payload.flow !== 'password-reset') {
    await failPasswordResetRedirect(payload, tr.auth.callback.passwordResetLinkInvalid);
  }

  await runWithPasswordRecoverySessionExchange(() =>
    resolveSessionFromPayload(
      payload,
      (message) => failPasswordResetRedirect(payload, message),
    ),
  );
}

export async function updateRecoveredPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw sessionError ?? new Error(tr.auth.callback.sessionValidationFailed);
  }

  await persistAuthSession(session);
  return session;
}
