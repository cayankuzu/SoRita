import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

import type {
  AuthActionResult,
  RegisterData,
} from '@/mobile/app/app-shell/auth/authTypes';
import {
  clearCurrentUserState,
  persistAuthSession,
  persistResolvedAuthUser,
  resolveImmediateAuthUser,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import type { User } from '@/mobile/app/data/contracts/entities';
import {
  callJsonEdgeFunction,
  EdgeFunctionError,
  isMissingEdgeFunctionError,
} from '@/mobile/app/platform/api/edgeFunctions';
import { clearOutboxForUser } from '@/mobile/app/data/outbox/outboxStorage';
import { env } from '@/mobile/app/platform/config/env';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  normalizeEmailInput,
  normalizeUserBioInput,
  normalizeUserNameInput,
  normalizeUsernameInput,
} from '@/mobile/app/shared/validation/contentLimits';

async function loadAuthRedirectState() {
  return import('@/mobile/app/app-shell/auth/session/authRedirectState');
}

async function loadPushNotificationRepository() {
  return import('@/mobile/app/data/repositories/pushNotificationRepository');
}

async function loadSystemPushNotificationRepository() {
  return import('@/mobile/app/data/repositories/systemPushNotificationRepository');
}

async function loadPendingSignupMediaStorage() {
  return import('@/mobile/app/platform/storage/pendingSignupMedia');
}

async function loadContentModeration() {
  return import('@/mobile/app/shared/utils/contentModeration');
}

function toAuthActionResult(error: unknown): AuthActionResult {
  if (error instanceof EdgeFunctionError) {
    const edgeCode = error.code as AuthActionResult['code'] | undefined;

    return {
      success: false,
      code: edgeCode ?? 'unexpected',
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      code: 'unexpected',
      message: error.message,
    };
  }

  return { success: false, code: 'unexpected' };
}

function inferFallbackAuthCode(message?: string): AuthActionResult['code'] {
  const normalizedMessage = message?.toLowerCase() ?? '';

  if (normalizedMessage.includes('email not confirmed')) {
    return 'email_not_confirmed';
  }

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'invalid_credentials';
  }

  if (
    normalizedMessage.includes('password is known to be weak') ||
    normalizedMessage.includes('weak and easy to guess') ||
    normalizedMessage.includes('weak password')
  ) {
    return 'weak_password';
  }

  if (
    normalizedMessage.includes('user already registered') ||
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('profiles_email_key') ||
    normalizedMessage.includes('users_email_key')
  ) {
    return 'duplicate_email';
  }

  if (
    normalizedMessage.includes('profiles_username_key') ||
    normalizedMessage.includes('username already') ||
    (normalizedMessage.includes('username') && normalizedMessage.includes('duplicate'))
  ) {
    return 'duplicate_username';
  }

  return 'unexpected';
}

function toFallbackAuthActionResult(error: unknown): AuthActionResult {
  if (error instanceof Error) {
    return {
      success: false,
      code: inferFallbackAuthCode(error.message),
      message: error.message,
    };
  }

  return { success: false, code: 'unexpected' };
}

function shouldFallbackToDirectSupabaseAuth(error: unknown) {
  if (isMissingEdgeFunctionError(error)) {
    return true;
  }

  if (error instanceof EdgeFunctionError) {
    const normalizedCode = error.code?.trim().toLowerCase();

    return (
      error.status >= 500 ||
      normalizedCode === 'unexpected' ||
      normalizedCode === 'misconfigured'
    );
  }

  return error instanceof Error;
}

async function hydrateAuthenticatedUser(params: {
  session: Session;
  authUser: SupabaseAuthUser;
  setUser: Dispatch<SetStateAction<User | null>>;
}) {
  await persistAuthSession(params.session);
  const immediateUser = resolveImmediateAuthUser(params.authUser);
  params.setUser(immediateUser);
  await persistResolvedAuthUser(immediateUser);
  void syncAuthenticatedUser(params.authUser)
    .then((nextUser) => {
      if (nextUser) {
        params.setUser(nextUser);
      }
    })
    .catch((syncError) => {
      logger.warn('auth', 'Failed to sync authenticated user after login', syncError);
    });
}

type UseAuthActionsParams = {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
};

export function useAuthActions({ user, setUser }: UseAuthActionsParams) {
  const refreshUser = useCallback(async () => {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      await persistAuthSession(null);
      clearCurrentUserState();
      setUser(null);
      return;
    }

    setUser(await syncAuthenticatedUser(authUser));
  }, [setUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const normalizedEmail = normalizeEmailInput(email).trim();

      try {
        const response = await callJsonEdgeFunction<{
          session: {
            accessToken: string;
            refreshToken: string;
          };
        }>(env.supabaseAuthGatewayFunctionName, {
          action: 'login',
          email: normalizedEmail,
          password,
        });
        const { data, error } = await supabase.auth.setSession({
          access_token: response.session.accessToken,
          refresh_token: response.session.refreshToken,
        });

        if (error || !data.session || !data.user) {
          return {
            success: false,
            code: 'unexpected',
            message: error?.message,
          };
        }

        await hydrateAuthenticatedUser({
          session: data.session,
          authUser: data.user,
          setUser,
        });
        return { success: true };
      } catch (error) {
        if (!isMissingEdgeFunctionError(error)) {
          return toAuthActionResult(error);
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        return toFallbackAuthActionResult(error);
      }

      if (!data.session || !data.user) {
        return {
          success: false,
          code: 'unexpected',
          message: tr.auth.login.sessionCreateFailed,
        };
      }

      await hydrateAuthenticatedUser({
        session: data.session,
        authUser: data.user,
        setUser,
      });

      return { success: true };
    },
    [setUser],
  );

  const register = useCallback(async (data: RegisterData): Promise<AuthActionResult> => {
    const normalizedEmail = normalizeEmailInput(data.email).trim();
    const normalizedName = normalizeUserNameInput(data.name).trim();
    const normalizedUsername = normalizeUsernameInput(data.username).trim();
    const normalizedBio = normalizeUserBioInput(data.bio).trim();
    const { assertNoObjectionableContent } = await loadContentModeration();

    assertNoObjectionableContent([
      { label: tr.moderation.nameField, value: normalizedName },
      { label: tr.moderation.usernameField, value: normalizedUsername },
      { label: tr.auth.register.bioLabel, value: normalizedBio },
    ]);

    const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
    const redirect = await createTrackedAuthRedirect('signup');

    try {
      await callJsonEdgeFunction<{ success: true }>(
        env.supabaseAuthGatewayFunctionName,
        {
          action: 'register',
          bio: normalizedBio || undefined,
          coverPhoto: data.coverPhoto,
          email: normalizedEmail,
          interests: data.interests?.length ? data.interests : undefined,
          legalConsent: data.legalConsent,
          name: normalizedName,
          password: data.password,
          profilePhoto: data.profilePhoto,
          redirectUrl: redirect.url,
          username: normalizedUsername,
        },
      );
    } catch (error) {
      if (!shouldFallbackToDirectSupabaseAuth(error)) {
        await discardPendingAuthRedirectState(redirect.state);
        return toAuthActionResult(error);
      }

      const { error: fallbackError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: data.password,
        options: {
          emailRedirectTo: redirect.url,
          data: {
            bio: normalizedBio || null,
            community_safety_acknowledged: true,
            cover_photo_url: data.coverPhoto ?? null,
            interests: data.interests?.length ? data.interests : null,
            legal_consent_at: data.legalConsent.acceptedAt,
            legal_consent_documents: data.legalConsent.documentsAccepted,
            legal_consent_version: data.legalConsent.version,
            name: normalizedName,
            profile_photo_url: data.profilePhoto ?? null,
            username: normalizedUsername,
          },
        },
      });

      if (fallbackError) {
        await discardPendingAuthRedirectState(redirect.state);
        return toFallbackAuthActionResult(fallbackError);
      }
    }

    const { savePendingSignupMedia } = await loadPendingSignupMediaStorage();

    try {
      await savePendingSignupMedia({
        email: normalizedEmail,
        profilePhoto: data.profilePhoto,
        coverPhoto: data.coverPhoto,
      });
    } catch (storageError) {
      logger.warn('auth', 'Failed to persist pending signup media', storageError);
    }

    return {
      success: true,
      code: 'signup_pending_confirmation',
    };
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string): Promise<AuthActionResult> => {
    const normalizedEmail = normalizeEmailInput(email).trim();
    const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
    const redirect = await createTrackedAuthRedirect('signup');

    try {
      await callJsonEdgeFunction<{ success: true }>(
        env.supabaseAuthGatewayFunctionName,
        {
          action: 'resend-confirmation',
          email: normalizedEmail,
          redirectUrl: redirect.url,
        },
      );
    } catch (error) {
      if (!shouldFallbackToDirectSupabaseAuth(error)) {
        await discardPendingAuthRedirectState(redirect.state);
        return toAuthActionResult(error);
      }

      const { error: fallbackError } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirect.url,
        },
      });

      if (fallbackError) {
        await discardPendingAuthRedirectState(redirect.state);
        return toFallbackAuthActionResult(fallbackError);
      }
    }

    return { success: true };
  }, []);

  const requestPasswordResetEmail = useCallback(async (email: string): Promise<AuthActionResult> => {
    const normalizedEmail = normalizeEmailInput(email).trim();
    const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
    const redirect = await createTrackedAuthRedirect('password-reset');

    try {
      await callJsonEdgeFunction<{ success: true }>(
        env.supabaseAuthGatewayFunctionName,
        {
          action: 'request-password-reset',
          email: normalizedEmail,
          redirectUrl: redirect.url,
        },
      );
    } catch (error) {
      await discardPendingAuthRedirectState(redirect.state);

      if (error instanceof EdgeFunctionError && error.code === 'email_not_found') {
        return toAuthActionResult(error);
      }

      if (shouldFallbackToDirectSupabaseAuth(error)) {
        return {
          success: false,
          code: error instanceof EdgeFunctionError ? (error.code as AuthActionResult['code']) ?? 'unexpected' : 'unexpected',
          message: tr.settings.toast.passwordResetFailed,
        };
      }

      return toAuthActionResult(error);
    }

    return { success: true };
  }, []);

  const requestPasswordReset = useCallback(
    async (currentPassword: string): Promise<AuthActionResult> => {
      if (!user) {
        return { success: false, code: 'unexpected' };
      }

      const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
      const redirect = await createTrackedAuthRedirect('password-reset');
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        await discardPendingAuthRedirectState(redirect.state);
        return { success: false, code: 'unexpected', message: error?.message };
      }

      try {
        await callJsonEdgeFunction<{ success: true }>(
          env.supabaseAuthGatewayFunctionName,
          {
            action: 'request-password-reset-authenticated',
            currentPassword,
            redirectUrl: redirect.url,
          },
          {
            accessToken: session.access_token,
          },
        );
      } catch (edgeError) {
        if (!shouldFallbackToDirectSupabaseAuth(edgeError)) {
          await discardPendingAuthRedirectState(redirect.state);
          return toAuthActionResult(edgeError);
        }

        const {
          data: authenticatedUserData,
          error: authenticatedUserError,
        } = await supabase.auth.getUser();
        const authenticatedUserEmail = authenticatedUserData.user?.email ?? null;

        if (authenticatedUserError || !authenticatedUserEmail) {
          await discardPendingAuthRedirectState(redirect.state);
          return {
            success: false,
            code: 'unexpected',
            message: authenticatedUserError?.message ?? 'Oturum dogrulanamadi.',
          };
        }

        const verificationResult = await supabase.auth.signInWithPassword({
          email: authenticatedUserEmail,
          password: currentPassword,
        });

        if (verificationResult.error) {
          await discardPendingAuthRedirectState(redirect.state);
          return toFallbackAuthActionResult(verificationResult.error);
        }

        if (verificationResult.data.session) {
          await persistAuthSession(verificationResult.data.session);
        }

        const resetPasswordResult = await supabase.auth.resetPasswordForEmail(
          authenticatedUserEmail,
          {
            redirectTo: redirect.url,
          },
        );

        if (resetPasswordResult.error) {
          await discardPendingAuthRedirectState(redirect.state);
          return toFallbackAuthActionResult(resetPasswordResult.error);
        }
      }

      return { success: true };
    },
    [user],
  );

  const logout = useCallback(async () => {
    const { unregisterPushNotifications } = await loadPushNotificationRepository();
    const { unregisterSystemPushNotifications } = await loadSystemPushNotificationRepository();
    const userId = user?.id;
    await persistAuthSession(null);
    if (userId) {
      await clearOutboxForUser(userId).catch((err) => { logger.debug('auth', 'Failed to clear outbox during logout', err); });
    }
    await unregisterPushNotifications(null).catch((err) => { logger.debug('auth', 'Failed to unregister push notifications during logout', err); });
    await unregisterSystemPushNotifications().catch((err) => { logger.debug('auth', 'Failed to unregister system push notifications during logout', err); });
    await supabase.auth.signOut();
    clearCurrentUserState();
    setUser(null);
  }, [setUser, user?.id]);

  return useMemo(
    () => ({
      login,
      logout,
      refreshUser,
      register,
      requestPasswordResetEmail,
      requestPasswordReset,
      resendConfirmationEmail,
    }),
    [
      login,
      logout,
      refreshUser,
      register,
      requestPasswordResetEmail,
      requestPasswordReset,
      resendConfirmationEmail,
    ],
  );
}
