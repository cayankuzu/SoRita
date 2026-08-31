import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AuthChangeEvent, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { Alert, AppState } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { purgeAuthenticatedUserState } from '@/mobile/app/app-shell/auth/session/authUserStatePurge';
import {
  clearCurrentUserState,
  getActiveOrPersistedSession,
  getVerifiedAuthUser,
  isMissingAuthenticatedAccountError,
  getPersistedAuthUserSnapshot,
  persistAuthSession,
  persistResolvedAuthUser,
  restorePersistedVisibleDataSnapshot,
  resolveImmediateAuthUser,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import { isPasswordRecoverySessionExchangeActive } from '@/mobile/app/app-shell/auth/session/passwordRecoverySessionGuard';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { refreshSupabaseSession } from '@/mobile/app/platform/supabase/sessionRefresh';
import { t } from '@/mobile/app/shared/i18n';
import {
  AUTH_BOOTSTRAP_SHELL_FALLBACK_MS,
  STARTUP_CACHE_RESTORE_BUDGET_MS,
} from '@/mobile/app/shared/performance/budgets';

type UseAuthSessionLifecycleParams = {
  setBooted: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<User | null>>;
};

const AUTH_SESSION_EXPIRY_SAFETY_WINDOW_MS = 5 * 60_000;
const AUTH_SESSION_REVALIDATION_MIN_DELAY_MS = 30_000;
const AUTH_SESSION_REVALIDATION_RETRY_DELAY_MS = 60_000;

function getSessionRevalidationDelay(session: Session | null) {
  if (typeof session?.expires_at !== 'number') {
    return null;
  }

  return Math.max(
    AUTH_SESSION_REVALIDATION_MIN_DELAY_MS,
    session.expires_at * 1000 - Date.now() - AUTH_SESSION_EXPIRY_SAFETY_WINDOW_MS,
  );
}

function isSessionInsideExpirySafetyWindow(session: Session | null) {
  return (
    typeof session?.expires_at === 'number'
    && session.expires_at * 1000 - Date.now() <= AUTH_SESSION_EXPIRY_SAFETY_WINDOW_MS
  );
}

async function transitionAuthScope(previousUserId: string | null, nextUserId: string | null) {
  if (previousUserId === nextUserId) {
    return previousUserId;
  }

  try {
    await purgeAuthenticatedUserState(previousUserId);
  } catch (error) {
    logger.warn('auth', 'Failed to fully purge the previous auth scope.', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  return nextUserId;
}

export function useAuthSessionLifecycle({
  setBooted,
  setUser,
}: UseAuthSessionLifecycleParams) {
  useEffect(() => {
    let mounted = true;
    let isBootstrapping = true;
    let hasShownMissingAccountAlert = false;
    let sessionRevalidationTimeout: ReturnType<typeof setTimeout> | null = null;
    let sessionRevalidationGeneration = 0;
    let sessionRevalidationInFlight: Promise<void> | null = null;
    let bootstrapFallbackTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeAuthUserId: string | null = null;

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
      stopScheduledSessionRevalidation();
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
      await supabase.auth.signOut().catch((err) => { logger.debug('auth', 'Failed to sign out after missing account', err); });
      activeAuthUserId = await transitionAuthScope(activeAuthUserId, null);
      clearSignedOutState();

      if (mounted) {
        Alert.alert(
          t.system.missingAccountTitle,
          t.system.missingAccountMessage,
        );
      }
    };

    const syncAuthState = async (authUser: SupabaseAuthUser | null, session: Session | null) => {
      try {
        activeAuthUserId = await transitionAuthScope(activeAuthUserId, authUser?.id ?? null);

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

        scheduleSessionRevalidation(session);
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

      // exchangeCodeForSession emits SIGNED_IN even for a PKCE password-reset
      // code. Recovery sessions stay scoped to the reset screen so the root
      // navigator is not remounted into MainTabs before a password is chosen.
      if (
        event === 'PASSWORD_RECOVERY'
        || (event === 'SIGNED_IN' && isPasswordRecoverySessionExchangeActive())
      ) {
        setBootedIfMounted();
        return;
      }

      await persistAuthSession(session);
      await syncAuthState(session?.user ?? null, session);
    };

    const revalidateActiveSession = (options: { refreshIfExpiring?: boolean } = {}) => {
      if (isBootstrapping) {
        return Promise.resolve();
      }

      if (sessionRevalidationInFlight) {
        return sessionRevalidationInFlight;
      }

      sessionRevalidationInFlight = (async () => {
        const session = await getActiveOrPersistedSession();

        if (!session?.user) {
          await persistAuthSession(null);
          clearSignedOutState();
          return;
        }

        let sessionToValidate = session;

        if (options.refreshIfExpiring && isSessionInsideExpirySafetyWindow(session)) {
          const { data, error } = await refreshSupabaseSession();

          if (error) {
            logger.warn('auth', 'Failed to refresh auth session before expiry', error);
            scheduleSessionRevalidation(session, AUTH_SESSION_REVALIDATION_RETRY_DELAY_MS);
            return;
          }

          if (!data.session?.user) {
            await persistAuthSession(null);
            clearSignedOutState();
            return;
          }

          sessionToValidate = data.session;
          await persistAuthSession(sessionToValidate);
        }

        const verifiedAuthUser = await getVerifiedAuthUser(sessionToValidate);

        if (!verifiedAuthUser) {
          await handleMissingAuthenticatedAccount();
          return;
        }

        scheduleSessionRevalidation(sessionToValidate);
      })().catch(async (error) => {
        if (isMissingAuthenticatedAccountError(error)) {
          await handleMissingAuthenticatedAccount();
          return;
        }

        logger.warn('auth', 'Failed to revalidate auth session', error);
      }).finally(() => {
        sessionRevalidationInFlight = null;
      });

      return sessionRevalidationInFlight;
    };

    const stopScheduledSessionRevalidation = () => {
      sessionRevalidationGeneration += 1;

      if (sessionRevalidationTimeout) {
        clearTimeout(sessionRevalidationTimeout);
        sessionRevalidationTimeout = null;
      }
    };

    const scheduleSessionRevalidation = (session: Session | null, overrideDelay?: number) => {
      stopScheduledSessionRevalidation();
      const revalidationDelay = overrideDelay ?? getSessionRevalidationDelay(session);

      if (revalidationDelay == null) {
        return;
      }

      const generation = sessionRevalidationGeneration;

      sessionRevalidationTimeout = setTimeout(() => {
        if (generation !== sessionRevalidationGeneration) {
          return;
        }

        sessionRevalidationTimeout = null;
        void revalidateActiveSession({ refreshIfExpiring: true });
      }, revalidationDelay);
    };

    const stopBootstrapFallback = () => {
      if (bootstrapFallbackTimeout) {
        clearTimeout(bootstrapFallbackTimeout);
        bootstrapFallbackTimeout = null;
      }
    };

    const startBootstrapFallback = () => {
      stopBootstrapFallback();
      bootstrapFallbackTimeout = setTimeout(() => {
        bootstrapFallbackTimeout = null;

        if (!mounted || !isBootstrapping) {
          return;
        }

        logger.debug('auth', 'Auth bootstrap is taking longer than expected; showing app shell fallback.');
        setBootedIfMounted();
      }, AUTH_BOOTSTRAP_SHELL_FALLBACK_MS);
    };

    const bootstrapAuth = async () => {
      startBootstrapFallback();

      try {
        const persistedUser = await getPersistedAuthUserSnapshot();

        if (persistedUser) {
          activeAuthUserId = persistedUser.id;
          setUserIfMounted(persistedUser);
          let cacheRestoreBudgetTimeout: ReturnType<typeof setTimeout> | null = null;
          const cacheRestore = restorePersistedVisibleDataSnapshot(persistedUser.id).catch((error) => {
            logger.warn('auth', 'Failed to restore cached startup data', error);
            return null;
          });
          const cacheRestoreBudget = new Promise<void>((resolve) => {
            cacheRestoreBudgetTimeout = setTimeout(resolve, STARTUP_CACHE_RESTORE_BUDGET_MS);
          });

          // Give local data a tiny head start so the first rendered shell can
          // already contain content, without ever turning disk I/O into a long
          // splash-screen dependency.
          await Promise.race([cacheRestore, cacheRestoreBudget]);
          if (cacheRestoreBudgetTimeout) {
            clearTimeout(cacheRestoreBudgetTimeout);
          }
          setBootedIfMounted();
          void cacheRestore;
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
        stopBootstrapFallback();
      }
    };

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthStateChange(event, session);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void revalidateActiveSession({ refreshIfExpiring: true });
        return;
      }

      stopScheduledSessionRevalidation();
    });

    return () => {
      mounted = false;
      stopBootstrapFallback();
      stopScheduledSessionRevalidation();
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [setBooted, setUser]);
}
