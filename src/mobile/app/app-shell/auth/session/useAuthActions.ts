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
  resolveImmediateAuthUser,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import { checkAccountAvailability } from '@/mobile/app/data/repositories/accountAvailability';
import type { User } from '@/mobile/app/data/contracts/entities';
import {
  getActiveExpoPushToken,
  unregisterPushNotifications,
} from '@/mobile/app/data/repositories/pushNotificationRepository';
import { env } from '@/mobile/app/platform/config/env';
import { savePendingSignupMedia } from '@/mobile/app/platform/storage/pendingSignupMedia';
import { supabase } from '@/mobile/app/platform/supabase/client';

type UseAuthActionsParams = {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
};

export function useAuthActions({ user, setUser }: UseAuthActionsParams) {
  const refreshUser = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
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
      setUser(resolveImmediateAuthUser(data.user));
      void syncAuthenticatedUser(data.user)
        .then((nextUser) => {
          if (nextUser) {
            setUser(nextUser);
          }
        })
        .catch((syncError) => {
          console.error('Failed to sync authenticated user after login', syncError);
        });
      return { success: true };
    },
    [setUser],
  );

  const register = useCallback(async (data: RegisterData): Promise<AuthActionResult> => {
    const normalizedUsername = data.username.trim().toLowerCase();

    const { error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        emailRedirectTo: env.authRedirectUrl,
        data: {
          name: data.name.trim(),
          username: normalizedUsername,
          bio: data.bio?.trim() || null,
          interests: data.interests?.length ? data.interests : null,
        },
      },
    });

    if (error) {
      const code = getAuthErrorCode(error.message);

      if (code === 'unexpected') {
        try {
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
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: env.authRedirectUrl,
      },
    });

    if (error) {
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

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: env.authRedirectUrl,
      });

      if (error) {
        return { success: false, code: 'unexpected', message: error.message };
      }

      return { success: true };
    },
    [user],
  );

  const logout = useCallback(async () => {
    await persistAuthSession(null);
    await unregisterPushNotifications(getActiveExpoPushToken()).catch(() => undefined);
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
      requestPasswordReset,
      resendConfirmationEmail,
    }),
    [login, logout, refreshUser, register, requestPasswordReset, resendConfirmationEmail],
  );
}
