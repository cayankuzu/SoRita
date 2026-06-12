import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AuthChangeEvent, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { Alert, AppState } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import {
  clearCurrentUserState,
  getActiveOrPersistedSession,
  getVerifiedAuthUser,
  isMissingAuthenticatedAccountError,
  getPersistedAuthUserSnapshot,
  persistAuthSession,
  persistResolvedAuthUser,
  resolveImmediateAuthUser,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';

type UseAuthSessionLifecycleParams = {
  setBooted: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<User | null>>;
};

const AUTH_SESSION_REVALIDATION_INTERVAL_MS = 60_000;

export function useAuthSessionLifecycle({
  setBooted,
  setUser,
}: UseAuthSessionLifecycleParams) {
  useEffect(() => {
    let mounted = true;
    let isBootstrapping = true;
    let hasShownMissingAccountAlert = false;
    let sessionRevalidationInterval: ReturnType<typeof setInterval> | null = null;

    const setBootedIfMounted = () => {
      if (mounted) {
        setBooted(true);
      }
    };

    const setUserIfMounted = (nextUser: User | null) => {
      if (mounted) {
        setUser(nextUser);
      }
    };

    const clearSignedOutState = () => {
      clearCurrentUserState();
      setUserIfMounted(null);
      setBootedIfMounted();
    };

    const handleMissingAuthenticatedAccount = async () => {
      if (hasShownMissingAccountAlert) {
        return;
      }

      hasShownMissingAccountAlert = true;
      await persistAuthSession(null);
      await supabase.auth.signOut().catch(() => undefined);
      clearSignedOutState();

      if (mounted) {
        Alert.alert(
          'Hesap silindi',
          'Bu hesap artik mevcut olmadigi icin oturumun kapatildi.',
        );
      }
    };

    const syncAuthState = async (authUser: SupabaseAuthUser | null, session: Session | null) => {
      try {
        if (!authUser) {
          clearSignedOutState();
          return;
        }

        hasShownMissingAccountAlert = false;

        const immediateUser = resolveImmediateAuthUser(authUser);
        setUserIfMounted(immediateUser);
        await persistResolvedAuthUser(immediateUser);
        setBootedIfMounted();

        const verifiedAuthUser = await getVerifiedAuthUser(session);

        if (!verifiedAuthUser) {
          await handleMissingAuthenticatedAccount();
          return;
        }

        const nextUser = await syncAuthenticatedUser(verifiedAuthUser);
        if (nextUser) {
          setUserIfMounted(nextUser);
        }
      } catch (error) {
        if (isMissingAuthenticatedAccountError(error)) {
          await handleMissingAuthenticatedAccount();
          return;
        }

        logger.warn('auth', 'Failed to sync auth state', error);
      } finally {
        setBootedIfMounted();
      }
    };

    const handleAuthStateChange = async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'INITIAL_SESSION' || isBootstrapping) {
        return;
      }

      await persistAuthSession(session);
      await syncAuthState(session?.user ?? null, session);
    };

    const revalidateActiveSession = async () => {
      if (isBootstrapping) {
        return;
      }

      try {
        const session = await getActiveOrPersistedSession();

        if (!session?.user) {
          await persistAuthSession(null);
          clearSignedOutState();
          return;
        }

        await getVerifiedAuthUser(session);
      } catch (error) {
        if (isMissingAuthenticatedAccountError(error)) {
          await handleMissingAuthenticatedAccount();
          return;
        }

        logger.warn('auth', 'Failed to revalidate auth session', error);
      }
    };

    const stopSessionRevalidation = () => {
      if (sessionRevalidationInterval) {
        clearInterval(sessionRevalidationInterval);
        sessionRevalidationInterval = null;
      }
    };

    const startSessionRevalidation = () => {
      stopSessionRevalidation();
      sessionRevalidationInterval = setInterval(() => {
        void revalidateActiveSession();
      }, AUTH_SESSION_REVALIDATION_INTERVAL_MS);
    };

    const bootstrapAuth = async () => {
      try {
        const persistedUser = await getPersistedAuthUserSnapshot();

        if (persistedUser) {
          setUserIfMounted(persistedUser);
          setBootedIfMounted();
        }

        const session = await getActiveOrPersistedSession();

        if (!session?.user) {
          await persistAuthSession(null);
        }

        await syncAuthState(session?.user ?? null, session);
      } catch (error) {
        logger.error('auth', 'Failed to bootstrap auth state', error);
        await persistAuthSession(null);
        clearSignedOutState();
      } finally {
        isBootstrapping = false;
      }
    };

    void bootstrapAuth();
    startSessionRevalidation();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthStateChange(event, session);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startSessionRevalidation();
        void revalidateActiveSession();
        return;
      }

      stopSessionRevalidation();
    });

    return () => {
      mounted = false;
      stopSessionRevalidation();
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [setBooted, setUser]);
}
