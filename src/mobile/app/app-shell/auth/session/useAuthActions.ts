import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

import type {
  AuthActionResult,
  RegisterData,
} from '@/mobile/app/app-shell/auth/authTypes';
import {
  persistAuthSession,
  persistResolvedAuthUser,
  resolveImmediateAuthUser,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import { purgeAuthenticatedUserState } from '@/mobile/app/app-shell/auth/session/authUserStatePurge';
import type { User } from '@/mobile/app/data/contracts/entities';
import {
  callJsonEdgeFunction,
  EdgeFunctionError,
} from '@/mobile/app/platform/api/edgeFunctions';
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

function useAuthenticatedPasswordReset(user: User | null) {
  return useCallback(
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
        await discardPendingAuthRedirectState(redirect.state);
        return toAuthActionResult(edgeError);
      }

      return { success: true };
    },
    [user],
  );
}

export function useAuthActions({ user, setUser }: UseAuthActionsParams) {
  const refreshUser = useCallback(async () => {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      const localCleanup = await Promise.allSettled([
        persistAuthSession(null),
        purgeAuthenticatedUserState(user?.id ?? null),
      ]);
      setUser(null);

      if (localCleanup.some((result) => result.status === 'rejected')) {
        logger.error('auth', 'Local auth cleanup was incomplete while refreshing the user.', {
          failedOperations: localCleanup.flatMap((result, index) =>
            result.status === 'rejected'
              ? [index === 0 ? 'persisted-auth-session' : 'authenticated-user-state']
              : []),
        });
        throw new Error('Local auth cleanup was incomplete.');
      }

      return;
    }

    setUser(await syncAuthenticatedUser(authUser));
  }, [setUser, user?.id]);

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
        return toAuthActionResult(error);
      }
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
      await discardPendingAuthRedirectState(redirect.state);
      return toAuthActionResult(error);
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
      await discardPendingAuthRedirectState(redirect.state);
      return toAuthActionResult(error);
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
      return toAuthActionResult(error);
    }

    return { success: true };
  }, []);

  const requestPasswordReset = useAuthenticatedPasswordReset(user);

  const logout = useCallback(async () => {
    const userId = user?.id;
    let remoteSignOutError: unknown;
    let localCleanupError: Error | null = null;

    try {
      try {
        const [{ unregisterAllPushNotifications }, { unregisterSystemPushNotifications }] =
          await Promise.all([
            loadPushNotificationRepository(),
            loadSystemPushNotificationRepository(),
          ]);
        await Promise.all([
          unregisterAllPushNotifications().catch((err) => {
            logger.debug('auth', 'Failed to unregister push notifications during logout', err);
          }),
          unregisterSystemPushNotifications().catch((err) => {
            logger.debug('auth', 'Failed to unregister system push notifications during logout', err);
          }),
        ]);
      } catch (error) {
        logger.debug('auth', 'Failed to load push cleanup during logout', error);
      }

      try {
        const signOutResult = await supabase.auth.signOut();

        if (signOutResult?.error) {
          remoteSignOutError = signOutResult.error;
        }
      } catch (error) {
        remoteSignOutError = error;
      }
    } finally {
      const localCleanup = await Promise.allSettled([
        persistAuthSession(null),
        purgeAuthenticatedUserState(userId ?? null),
      ]);
      const failedOperations = localCleanup.flatMap((result, index) =>
        result.status === 'rejected'
          ? [index === 0 ? 'persisted-auth-session' : 'authenticated-user-state']
          : []);

      if (failedOperations.length > 0) {
        logger.error('auth', 'Local logout cleanup was incomplete.', { failedOperations });
        localCleanupError = new Error('Local logout cleanup was incomplete.');
      }

      setUser(null);
    }

    if (remoteSignOutError) {
      throw remoteSignOutError;
    }

    if (localCleanupError) {
      throw localCleanupError;
    }
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
