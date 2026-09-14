import type { Dispatch, SetStateAction } from 'react';
import type { AuthChangeEvent, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { Alert, AppState } from 'react-native';

import {
  AUTH_SESSION_REVALIDATION_RETRY_DELAY_MS,
  createAuthBootstrapFallback,
  createAuthScopeOperationCoordinator,
  createSessionRevalidationScheduler,
  isSessionInsideExpirySafetyWindow,
  type AuthScopeOperation,
  type SessionRevalidationOptions,
} from '@/mobile/app/app-shell/auth/session/authSessionLifecycleCoordination';
import {
  clearCurrentUserState,
  getActiveOrPersistedSession,
  getPersistedAuthUserSnapshot,
  getVerifiedAuthUser,
  isMissingAuthenticatedAccountError,
  persistAuthSession,
  persistResolvedAuthUser,
  resolveImmediateAuthUser,
  restorePersistedVisibleDataSnapshot,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import { purgeAuthenticatedUserState } from '@/mobile/app/app-shell/auth/session/authUserStatePurge';
import { isPasswordRecoverySessionExchangeActive } from '@/mobile/app/app-shell/auth/session/passwordRecoverySessionGuard';
import type { User } from '@/mobile/app/data/contracts/entities';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { refreshSupabaseSession } from '@/mobile/app/platform/supabase/sessionRefresh';
import { t } from '@/mobile/app/shared/i18n';
import { STARTUP_CACHE_RESTORE_BUDGET_MS } from '@/mobile/app/shared/performance/budgets';

export type AuthSessionLifecycleParams = {
  setBooted: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<User | null>>;
};

class AuthScopeTransitionError extends Error {
  constructor(options?: ErrorOptions) {
    super('Authenticated user scope transition failed.', options);
    this.name = 'AuthScopeTransitionError';
  }
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
    throw new AuthScopeTransitionError({ cause: error });
  }

  return nextUserId;
}

async function stagePushTokenCleanupForAuthTransition(
  previousUserId: string | null,
  nextUserId: string | null,
) {
  if (!previousUserId || previousUserId === nextUserId) {
    return;
  }

  try {
    const { stageActivePushTokenCleanupForAuthTransition } = await import(
      '@/mobile/app/data/repositories/pushNotificationRepository'
    );
    await stageActivePushTokenCleanupForAuthTransition();
  } catch (error) {
    // A forced/expired session cannot be resurrected. Keep any existing
    // secure tombstone intact; the signed-out cleanup host will retry it.
    logger.warn('auth', 'Could not stage push cleanup during auth transition.', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}

class AuthSessionLifecycleRuntime {
  private activeAuthUserId: string | null = null;
  private hasShownMissingAccountAlert = false;
  private isBootstrapping = true;
  private mounted = true;
  private sessionRevalidationInFlight: Promise<void> | null = null;
  private readonly authScopeOperations;
  private readonly bootstrapFallback;
  private readonly sessionRevalidation;

  constructor(private readonly params: AuthSessionLifecycleParams) {
    this.authScopeOperations = createAuthScopeOperationCoordinator(() => this.mounted);
    this.bootstrapFallback = createAuthBootstrapFallback(
      () => this.mounted && this.isBootstrapping,
      () => this.setBootedIfMounted(),
    );
    this.sessionRevalidation = createSessionRevalidationScheduler((options) => {
      void this.revalidateActiveSession(options);
    });
  }

  start() {
    const bootstrapOperation = this.authScopeOperations.begin(undefined);
    void this.authScopeOperations.start(
      bootstrapOperation,
      () => this.bootstrapAuth(bootstrapOperation),
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      this.handleAuthStateChangeEvent(event, session);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void this.revalidateActiveSession({ refreshIfExpiring: true });
        return;
      }

      this.sessionRevalidation.stop();
    });

    return () => {
      this.mounted = false;
      this.authScopeOperations.invalidate();
      this.bootstrapFallback.stop();
      this.sessionRevalidation.stop();
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }

  private setBootedIfMounted() {
    if (this.mounted) {
      this.params.setBooted(true);
    }
  }

  private setUserIfMounted(nextUser: User | null) {
    if (this.mounted) {
      this.params.setUser(nextUser);
    }
  }

  private closeVisibleAuthScope() {
    clearCurrentUserState();
    this.setUserIfMounted(null);
  }

  private clearSignedOutState() {
    this.sessionRevalidation.stop();
    this.closeVisibleAuthScope();
    this.setBootedIfMounted();
  }

  private failClosedAuthScopeTransition() {
    this.clearSignedOutState();
    if (this.mounted) {
      this.sessionRevalidation.schedule(null, AUTH_SESSION_REVALIDATION_RETRY_DELAY_MS);
    }
  }

  private async transitionActiveAuthScope(
    nextUserId: string | null,
    operation: AuthScopeOperation,
  ) {
    if (!this.authScopeOperations.isCurrent(operation, nextUserId)) {
      return false;
    }

    try {
      const transitionedUserId = await transitionAuthScope(this.activeAuthUserId, nextUserId);

      if (!this.authScopeOperations.isCurrent(operation, nextUserId)) {
        return false;
      }

      this.activeAuthUserId = transitionedUserId;
      return true;
    } catch (error) {
      if (!this.authScopeOperations.isCurrent(operation, nextUserId)) {
        return false;
      }

      if (!(error instanceof AuthScopeTransitionError)) {
        throw error;
      }

      this.failClosedAuthScopeTransition();
      return false;
    }
  }

  private async handleMissingAuthenticatedAccount(operation: AuthScopeOperation) {
    if (!this.authScopeOperations.isCurrent(operation) || this.hasShownMissingAccountAlert) {
      return;
    }

    this.hasShownMissingAccountAlert = true;
    this.closeVisibleAuthScope();

    if (!this.authScopeOperations.assignUser(operation, null)) {
      return;
    }

    await stagePushTokenCleanupForAuthTransition(this.activeAuthUserId, null);

    if (!this.authScopeOperations.isCurrent(operation, null)) {
      return;
    }

    await persistAuthSession(null);

    if (!this.authScopeOperations.isCurrent(operation, null)) {
      return;
    }

    await supabase.auth.signOut().catch((error) => {
      logger.debug('auth', 'Failed to sign out after missing account', error);
    });

    if (!this.authScopeOperations.isCurrent(operation, null)) {
      return;
    }

    if (!(await this.transitionActiveAuthScope(null, operation))) {
      return;
    }

    this.clearSignedOutState();
    if (this.mounted) {
      Alert.alert(t.system.missingAccountTitle, t.system.missingAccountMessage);
    }
  }

  private async syncAuthState(
    authUser: SupabaseAuthUser | null,
    session: Session | null,
    operation: AuthScopeOperation,
  ) {
    try {
      const nextAuthUserId = authUser?.id ?? null;

      if (!this.authScopeOperations.isCurrent(operation, nextAuthUserId)) {
        return;
      }

      if (this.activeAuthUserId && this.activeAuthUserId !== nextAuthUserId) {
        this.closeVisibleAuthScope();
      }
      await stagePushTokenCleanupForAuthTransition(this.activeAuthUserId, nextAuthUserId);

      if (!this.authScopeOperations.isCurrent(operation, nextAuthUserId)) {
        return;
      }

      if (!(await this.transitionActiveAuthScope(nextAuthUserId, operation))) {
        return;
      }

      if (!authUser) {
        this.clearSignedOutState();
        return;
      }

      this.hasShownMissingAccountAlert = false;
      const immediateUser = resolveImmediateAuthUser(authUser);
      this.setUserIfMounted(immediateUser);
      await persistResolvedAuthUser(immediateUser);

      if (!this.authScopeOperations.isCurrent(operation, nextAuthUserId)) {
        return;
      }

      this.setBootedIfMounted();
      const verifiedAuthUser = await getVerifiedAuthUser(session);

      if (!this.authScopeOperations.isCurrent(operation, nextAuthUserId)) {
        return;
      }

      if (!verifiedAuthUser) {
        await this.handleMissingAuthenticatedAccount(operation);
        return;
      }

      if (verifiedAuthUser.id !== nextAuthUserId) {
        this.failClosedAuthScopeTransition();
        return;
      }

      this.sessionRevalidation.schedule(session);
      const nextUser = await syncAuthenticatedUser(verifiedAuthUser, {
        isCurrent: () => this.authScopeOperations.isCurrent(operation, nextAuthUserId),
      });

      if (!this.authScopeOperations.isCurrent(operation, nextAuthUserId)) {
        return;
      }

      if (nextUser) {
        this.setUserIfMounted(nextUser);
      }
    } catch (error) {
      if (!this.authScopeOperations.isCurrent(operation)) {
        return;
      }

      if (isMissingAuthenticatedAccountError(error)) {
        await this.handleMissingAuthenticatedAccount(operation);
        return;
      }

      logger.warn('auth', 'Failed to sync auth state', error);
    } finally {
      this.setBootedIfMounted();
    }
  }

  private async handleAuthStateChange(session: Session | null, operation: AuthScopeOperation) {
    await persistAuthSession(session);

    if (!this.authScopeOperations.isCurrent(operation)) {
      return;
    }

    await this.syncAuthState(session?.user ?? null, session, operation);
  }

  private handleAuthStateChangeEvent(event: AuthChangeEvent, session: Session | null) {
    if (event === 'INITIAL_SESSION') {
      return;
    }

    // exchangeCodeForSession emits SIGNED_IN even for a PKCE password-reset
    // code. Recovery sessions stay scoped to the reset screen so the root
    // navigator is not remounted into MainTabs before a password is chosen.
    if (
      event === 'PASSWORD_RECOVERY'
      || (event === 'SIGNED_IN' && isPasswordRecoverySessionExchangeActive())
    ) {
      this.setBootedIfMounted();
      return;
    }

    const nextUserId = session?.user?.id ?? null;
    const operation = this.authScopeOperations.begin(nextUserId);

    if (this.activeAuthUserId && this.activeAuthUserId !== nextUserId) {
      this.closeVisibleAuthScope();
    }

    void this.authScopeOperations
      .enqueue(operation, () => this.handleAuthStateChange(session, operation))
      .catch((error) => {
        if (this.authScopeOperations.isCurrent(operation)) {
          logger.warn('auth', 'Failed to process auth state change', error);
        }
      });
  }

  private revalidateActiveSession(options: SessionRevalidationOptions = {}) {
    if (this.isBootstrapping) {
      return Promise.resolve();
    }

    if (this.sessionRevalidationInFlight) {
      return this.sessionRevalidationInFlight;
    }

    const requestedUserId = this.authScopeOperations.getRequestedUserId();
    const operation = this.authScopeOperations.begin(
      requestedUserId === undefined ? this.activeAuthUserId : requestedUserId,
    );
    this.sessionRevalidationInFlight = this.runSessionRevalidation(options, operation)
      .catch(async (error) => {
        if (!this.authScopeOperations.isCurrent(operation)) {
          return;
        }

        if (isMissingAuthenticatedAccountError(error)) {
          await this.handleMissingAuthenticatedAccount(operation);
          return;
        }

        logger.warn('auth', 'Failed to revalidate auth session', error);
      })
      .finally(() => {
        this.sessionRevalidationInFlight = null;
      });

    return this.sessionRevalidationInFlight;
  }

  private async clearSessionFromRevalidation(operation: AuthScopeOperation) {
    if (!this.authScopeOperations.assignUser(operation, null)) {
      return;
    }

    this.closeVisibleAuthScope();
    await stagePushTokenCleanupForAuthTransition(this.activeAuthUserId, null);

    if (!this.authScopeOperations.isCurrent(operation, null)) {
      return;
    }

    await persistAuthSession(null);

    if (!this.authScopeOperations.isCurrent(operation, null)) {
      return;
    }

    if (!(await this.transitionActiveAuthScope(null, operation))) {
      return;
    }

    this.clearSignedOutState();
  }

  private async runSessionRevalidation(
    options: SessionRevalidationOptions,
    operation: AuthScopeOperation,
  ) {
    const session = await getActiveOrPersistedSession();

    if (!this.authScopeOperations.isCurrent(operation)) {
      return;
    }

    if (!session?.user) {
      await this.clearSessionFromRevalidation(operation);
      return;
    }

    let sessionToValidate = session;

    if (!this.authScopeOperations.assignUser(operation, session.user.id)) {
      return;
    }

    if (this.activeAuthUserId && this.activeAuthUserId !== session.user.id) {
      this.closeVisibleAuthScope();
    }

    if (options.refreshIfExpiring && isSessionInsideExpirySafetyWindow(session)) {
      const { data, error } = await refreshSupabaseSession();

      if (!this.authScopeOperations.isCurrent(operation, session.user.id)) {
        return;
      }

      if (error) {
        logger.warn('auth', 'Failed to refresh auth session before expiry', error);
        this.sessionRevalidation.schedule(session, AUTH_SESSION_REVALIDATION_RETRY_DELAY_MS);
        return;
      }

      if (!data.session?.user) {
        await this.clearSessionFromRevalidation(operation);
        return;
      }

      sessionToValidate = data.session;
      if (!this.authScopeOperations.assignUser(operation, sessionToValidate.user.id)) {
        return;
      }

      await persistAuthSession(sessionToValidate);

      if (!this.authScopeOperations.isCurrent(operation, sessionToValidate.user.id)) {
        return;
      }
    }

    if (this.activeAuthUserId !== sessionToValidate.user.id) {
      await this.syncAuthState(sessionToValidate.user, sessionToValidate, operation);
      return;
    }

    const verifiedAuthUser = await getVerifiedAuthUser(sessionToValidate);

    if (!this.authScopeOperations.isCurrent(operation, sessionToValidate.user.id)) {
      return;
    }

    if (!verifiedAuthUser) {
      await this.handleMissingAuthenticatedAccount(operation);
      return;
    }

    if (verifiedAuthUser.id !== sessionToValidate.user.id) {
      this.failClosedAuthScopeTransition();
      return;
    }

    this.sessionRevalidation.schedule(sessionToValidate);
  }

  private async bootstrapAuth(operation: AuthScopeOperation) {
    this.bootstrapFallback.start();

    try {
      const persistedUser = await getPersistedAuthUserSnapshot();

      if (!this.authScopeOperations.isCurrent(operation)) {
        return;
      }

      if (persistedUser) {
        if (!this.authScopeOperations.assignUser(operation, persistedUser.id)) {
          return;
        }

        this.activeAuthUserId = persistedUser.id;
        this.setUserIfMounted(persistedUser);
        let cacheRestoreBudgetTimeout: ReturnType<typeof setTimeout> | null = null;
        const cacheRestore = restorePersistedVisibleDataSnapshot(persistedUser.id, {
          isCurrent: () => this.authScopeOperations.isCurrent(operation, persistedUser.id),
        }).catch((error) => {
          logger.warn('auth', 'Failed to restore cached startup data', error);
          return null;
        });
        const cacheRestoreBudget = new Promise<void>((resolve) => {
          cacheRestoreBudgetTimeout = setTimeout(resolve, STARTUP_CACHE_RESTORE_BUDGET_MS);
        });

        // Give local data a tiny head start so the first rendered shell can
        // already contain content, without turning disk I/O into a long splash dependency.
        await Promise.race([cacheRestore, cacheRestoreBudget]);
        if (cacheRestoreBudgetTimeout) {
          clearTimeout(cacheRestoreBudgetTimeout);
        }

        if (!this.authScopeOperations.isCurrent(operation)) {
          await cacheRestore;
          return;
        }

        this.setBootedIfMounted();
        void cacheRestore;
      }

      const session = await getActiveOrPersistedSession();

      if (!this.authScopeOperations.isCurrent(operation)) {
        return;
      }

      if (!this.authScopeOperations.assignUser(operation, session?.user?.id ?? null)) {
        return;
      }

      if (!session?.user) {
        await persistAuthSession(null);

        if (!this.authScopeOperations.isCurrent(operation, null)) {
          return;
        }
      }

      await this.syncAuthState(session?.user ?? null, session, operation);
    } catch (error) {
      await this.handleBootstrapFailure(error, operation);
    } finally {
      this.isBootstrapping = false;
      this.bootstrapFallback.stop();
    }
  }

  private async handleBootstrapFailure(error: unknown, operation: AuthScopeOperation) {
    if (!this.authScopeOperations.isCurrent(operation)) {
      return;
    }

    logger.error('auth', 'Failed to bootstrap auth state', error);
    this.closeVisibleAuthScope();

    if (!this.authScopeOperations.assignUser(operation, null)) {
      return;
    }

    await stagePushTokenCleanupForAuthTransition(this.activeAuthUserId, null);

    if (!this.authScopeOperations.isCurrent(operation, null)) {
      return;
    }

    await persistAuthSession(null);

    if (!this.authScopeOperations.isCurrent(operation, null)) {
      return;
    }

    if (!(await this.transitionActiveAuthScope(null, operation))) {
      return;
    }

    this.clearSignedOutState();
  }
}

export function startAuthSessionLifecycle(params: AuthSessionLifecycleParams) {
  return new AuthSessionLifecycleRuntime(params).start();
}
