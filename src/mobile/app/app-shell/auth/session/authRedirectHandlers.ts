import type { Session } from '@supabase/supabase-js';

import {
  clearCurrentUserState,
  persistAuthSession,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import {
  clearPendingAuthRedirectStates,
  consumePendingAuthRedirectState,
  type AuthRedirectParams,
} from '@/mobile/app/app-shell/auth/session/authRedirectState';
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

async function resolveSessionFromPayload(payload: AuthRedirectParams): Promise<Session> {
  if (payload.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(payload.code);

    if (error || !data.session) {
      return failAuthRedirect(error?.message || tr.auth.callback.sessionValidationFailed);
    }

    return data.session;
  }

  if (payload.accessToken && payload.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    });

    if (error || !data.session) {
      return failAuthRedirect(error?.message || tr.auth.callback.sessionValidationFailed);
    }

    return data.session;
  }

  return failAuthRedirect(tr.auth.callback.missingCode);
}

function getProviderErrorMessage(payload: AuthRedirectParams) {
  return payload.error ? (payload.errorCode ? `${payload.errorCode}: ${payload.error}` : payload.error) : null;
}

export async function completeSignupRedirect(payload: AuthRedirectParams) {
  const providerError = getProviderErrorMessage(payload);

  if (providerError) {
    await failAuthRedirect(providerError);
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
  const providerError = getProviderErrorMessage(payload);

  if (providerError) {
    await failAuthRedirect(providerError);
  }

  const validation = await consumePendingAuthRedirectState({
    flow: payload.flow,
    state: payload.state,
    target: payload.target,
  });

  if (!validation.success || payload.flow !== 'password-reset') {
    await failAuthRedirect(tr.auth.callback.passwordResetLinkInvalid);
  }

  const session = await resolveSessionFromPayload(payload);
  await persistAuthSession(session);
}

export async function updateRecoveredPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }

  await persistAuthSession(null);
  await supabase.auth.signOut().catch((err) => { logger.debug('auth', 'Failed to sign out after updating recovered password', err); });
  clearCurrentUserState();
}
