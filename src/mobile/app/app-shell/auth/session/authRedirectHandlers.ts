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

async function failPasswordResetRedirect(message: string): Promise<never> {
  // Deliberately does not discard the state. consumePendingAuthRedirectState
  // already removes it when it validates one, so discarding here only ever
  // destroyed a token that was still good - the provider-error branch above
  // runs before the state is consumed. That turned one bad attempt into a
  // permanently dead link, which is why retrying the same mail kept failing.
  throw new Error(message);
}

function hasSessionCredentials(payload: AuthRedirectParams) {
  return Boolean(payload.code || (payload.accessToken && payload.refreshToken));
}

/** Which credential kinds a link carried, for a log that names no secret. */
export function describeSessionCredentials(payload: AuthRedirectParams) {
  const kinds: string[] = [];

  if (payload.code) {
    kinds.push('code');
  }

  if (payload.accessToken) {
    kinds.push('access');
  }

  if (payload.refreshToken) {
    kinds.push('refresh');
  }

  return kinds.length > 0 ? kinds.join('+') : 'none';
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

  // Implicit flow. Only the client that started a PKCE flow can redeem a code,
  // and the reset mail is requested by the auth gateway, not by this device.
  // Supabase therefore hands the session back in the link's fragment.
  if (payload.accessToken && payload.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    });

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
    await failPasswordResetRedirect(tr.auth.callback.passwordResetLinkInvalid);
  }

  const validation = await consumePendingAuthRedirectState({
    flow: payload.flow,
    state: payload.state,
    target: payload.target,
  });

  if (!validation.success || payload.flow !== 'password-reset') {
    // The reason was computed and then thrown away, so every one of these
    // failures reached the user as the same sentence and none of them could
    // be told apart from a report. Record which case it was.
    logger.warn('auth', 'Password reset link rejected', {
      flow: payload.flow,
      hasState: Boolean(payload.state),
      reason: validation.success ? 'flow_mismatch' : validation.reason,
    });
    await failPasswordResetRedirect(tr.auth.callback.passwordResetLinkInvalid);
  }

  if (!hasSessionCredentials(payload)) {
    // "No code found" is true but useless here: the link is simply not usable,
    // and the user needs to be told to request a new one. The field is named
    // for the kind and not for the token, because the logger redacts any key
    // that looks like an access or refresh token - which silently blanked the
    // first version of this diagnostic.
    logger.warn('auth', 'Password reset link carried no session credential', {
      carried: describeSessionCredentials(payload),
    });
    await failPasswordResetRedirect(tr.auth.callback.passwordResetLinkInvalid);
  }

  await runWithPasswordRecoverySessionExchange(() =>
    resolveSessionFromPayload(
      payload,
      (message) => failPasswordResetRedirect(message),
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
