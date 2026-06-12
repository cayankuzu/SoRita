import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type {
  AuthActionResult,
  RegisterData,
} from '@/mobile/app/app-shell/auth/authTypes';
import {
  clearCurrentUserState,
  getAuthErrorCode,
  persistAuthSession,
  persistResolvedAuthUser,
  resolveImmediateAuthUser,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import type { User } from '@/mobile/app/data/contracts/entities';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';

async function loadAuthRedirectState() {
  return import('@/mobile/app/app-shell/auth/session/authRedirectState');
}

async function loadAccountAvailabilityRepository() {
  return import('@/mobile/app/data/repositories/accountAvailability');
}

async function loadPushNotificationRepository() {
  return import('@/mobile/app/data/repositories/pushNotificationRepository');
}

async function loadPendingSignupMediaStorage() {
  return import('@/mobile/app/platform/storage/pendingSignupMedia');
}

async function loadContentModeration() {
  return import('@/mobile/app/shared/utils/contentModeration');
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return {
          success: false,
          code: getAuthErrorCode(error.message),
          message: error.message,
        };
      }

      if (!data.user) {
        return { success: false, code: 'unexpected' };
      }

      await persistAuthSession(data.session ?? null);
      const immediateUser = resolveImmediateAuthUser(data.user);
      setUser(immediateUser);
      await persistResolvedAuthUser(immediateUser);
      void syncAuthenticatedUser(data.user)
        .then((nextUser) => {
          if (nextUser) {
            setUser(nextUser);
          }
        })
        .catch((syncError) => {
          logger.warn('auth', 'Failed to sync authenticated user after login', syncError);
        });
      return { success: true };
    },
    [setUser],
  );

  const register = useCallback(async (data: RegisterData): Promise<AuthActionResult> => {
    const normalizedUsername = data.username.trim().toLowerCase();
    const { assertNoObjectionableContent } = await loadContentModeration();

    assertNoObjectionableContent([
      { label: 'Ad alani', value: data.name },
      { label: 'Kullanici adi', value: normalizedUsername },
      { label: 'Biyografi', value: data.bio },
    ]);

    const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
    const redirect = await createTrackedAuthRedirect('signup');
    const { error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        emailRedirectTo: redirect.url,
        data: {
          name: data.name.trim(),
          username: normalizedUsername,
          bio: data.bio?.trim() || null,
          interests: data.interests?.length ? data.interests : null,
          legal_consent_at: data.legalConsent.acceptedAt,
          legal_consent_documents: data.legalConsent.documentsAccepted,
          legal_consent_version: data.legalConsent.version,
          community_safety_acknowledged: true,
        },
      },
    });

    if (error) {
      await discardPendingAuthRedirectState(redirect.state);
      const code = getAuthErrorCode(error.message);

      if (code === 'unexpected') {
        try {
          const { checkAccountAvailability } = await loadAccountAvailabilityRepository();
          const availability = await checkAccountAvailability({
            email: data.email,
            username: normalizedUsername,
          });

          if (!availability.emailAvailable) {
            return { success: false, code: 'duplicate_email', message: error.message };
          }

          if (!availability.usernameAvailable) {
            return { success: false, code: 'duplicate_username', message: error.message };
          }
        } catch {
          // Fall through to the original signup error.
        }
      }

      return {
        success: false,
        code,
        message: error.message,
      };
    }

    const { savePendingSignupMedia } = await loadPendingSignupMediaStorage();
    await savePendingSignupMedia({
      email: data.email,
      profilePhoto: data.profilePhoto,
      coverPhoto: data.coverPhoto,
    });

    return {
      success: true,
      code: 'signup_pending_confirmation',
    };
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string): Promise<AuthActionResult> => {
    const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
    const redirect = await createTrackedAuthRedirect('signup');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: redirect.url,
      },
    });

    if (error) {
      await discardPendingAuthRedirectState(redirect.state);
      return { success: false, code: 'unexpected', message: error.message };
    }

    return { success: true };
  }, []);

  const requestPasswordResetEmail = useCallback(async (email: string): Promise<AuthActionResult> => {
    const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
    const redirect = await createTrackedAuthRedirect('password-reset');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirect.url,
    });

    if (error) {
      await discardPendingAuthRedirectState(redirect.state);
      return { success: false, code: 'unexpected', message: error.message };
    }

    return { success: true };
  }, []);

  const requestPasswordReset = useCallback(
    async (currentPassword: string): Promise<AuthActionResult> => {
      if (!user) {
        return { success: false, code: 'unexpected' };
      }

      const verify = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verify.error) {
        return {
          success: false,
          code: getAuthErrorCode(verify.error.message),
          message: verify.error.message,
        };
      }

      const { createTrackedAuthRedirect, discardPendingAuthRedirectState } = await loadAuthRedirectState();
      const redirect = await createTrackedAuthRedirect('password-reset');
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: redirect.url,
      });

      if (error) {
        await discardPendingAuthRedirectState(redirect.state);
        return { success: false, code: 'unexpected', message: error.message };
      }

      return { success: true };
    },
    [user],
  );

  const logout = useCallback(async () => {
    const { unregisterPushNotifications } = await loadPushNotificationRepository();
    await persistAuthSession(null);
    await unregisterPushNotifications(null).catch(() => undefined);
    await supabase.auth.signOut();
    clearCurrentUserState();
    setUser(null);
  }, [setUser]);

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
