import { useCallback, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { isAuthSessionMissingError } from '@supabase/supabase-js';

import type {
  AuthActionResult,
  RegisterData,
} from '@/mobile/app/app-shell/auth/authTypes';
import { persistAuthSession } from '@/mobile/app/app-shell/auth/session/authSessionSupport';
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
      // The gateway sends Retry-After on a lockout and the transport already
      // parses it; dropping it here is what left the user reading "after a
      // while" when the exact wait was known.
      retryAfterMs: error.retryAfterMs,
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

type UseAuthActionsParams = {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
};

const ANY_AUTHENTICATED_OWNER = Symbol('any-authenticated-owner');

type ExpectedAuthOwnerTransition = {
  fromUserId: string | null;
  sourceGeneration: number;
  toUserId: string | null | typeof ANY_AUTHENTICATED_OWNER;
};

type AuthActionCoordinator = {
  expectedOwnerTransitions: ExpectedAuthOwnerTransition[];
  generation: number;
  ownerUserId: string | null;
  queue: Promise<void>;
};

type AuthActionCommitResult<T> =
  | { status: 'committed'; value: T }
  | { status: 'superseded' };

function beginAuthAction(coordinator: AuthActionCoordinator) {
  coordinator.generation += 1;
  return coordinator.generation;
}

function isAuthActionCurrent(coordinator: AuthActionCoordinator, generation: number) {
  return coordinator.generation === generation;
}

function beginExpectedAuthOwnerTransition(
  coordinator: AuthActionCoordinator,
  sourceGeneration: number,
  toUserId: ExpectedAuthOwnerTransition['toUserId'],
) {
  if (toUserId !== ANY_AUTHENTICATED_OWNER && coordinator.ownerUserId === toUserId) {
    return null;
  }

  const transition: ExpectedAuthOwnerTransition = {
    fromUserId: coordinator.ownerUserId,
    sourceGeneration,
    toUserId,
  };
  coordinator.expectedOwnerTransitions.push(transition);
  return transition;
}

function finishExpectedAuthOwnerTransition(
  coordinator: AuthActionCoordinator,
  transition: ExpectedAuthOwnerTransition | null,
) {
  if (!transition) {
    return;
  }

  const transitionIndex = coordinator.expectedOwnerTransitions.indexOf(transition);

  if (transitionIndex >= 0) {
    coordinator.expectedOwnerTransitions.splice(transitionIndex, 1);
  }
}

function pruneOlderExpectedAuthOwnerTransitions(
  coordinator: AuthActionCoordinator,
  sourceGeneration: number,
) {
  for (let index = coordinator.expectedOwnerTransitions.length - 1; index >= 0; index -= 1) {
    if (coordinator.expectedOwnerTransitions[index].sourceGeneration < sourceGeneration) {
      coordinator.expectedOwnerTransitions.splice(index, 1);
    }
  }
}

function retargetExpectedAuthOwnerTransition(
  coordinator: AuthActionCoordinator,
  transition: ExpectedAuthOwnerTransition | null,
  toUserId: string,
) {
  if (!transition || !coordinator.expectedOwnerTransitions.includes(transition)) {
    return;
  }

  pruneOlderExpectedAuthOwnerTransitions(coordinator, transition.sourceGeneration);
  transition.toUserId = toUserId;

  if (coordinator.ownerUserId === toUserId) {
    finishExpectedAuthOwnerTransition(coordinator, transition);
  }
}

function consumeExpectedAuthOwnerTransition(
  coordinator: AuthActionCoordinator,
  toUserId: string | null,
) {
  const transitionIndex = coordinator.expectedOwnerTransitions.findIndex(
    (transition) =>
      transition.fromUserId === coordinator.ownerUserId &&
      transition.sourceGeneration <= coordinator.generation &&
      (transition.toUserId === toUserId ||
        transition.toUserId === ANY_AUTHENTICATED_OWNER ||
        (toUserId === null && transition.toUserId !== null)),
  );

  if (transitionIndex < 0) {
    return false;
  }

  const previousOwnerUserId = coordinator.ownerUserId;
  const transition = coordinator.expectedOwnerTransitions[transitionIndex];
  pruneOlderExpectedAuthOwnerTransitions(coordinator, transition.sourceGeneration);

  if (
    transition.toUserId === ANY_AUTHENTICATED_OWNER ||
    (toUserId === null && transition.toUserId !== null)
  ) {
    transition.fromUserId = toUserId;
  } else {
    finishExpectedAuthOwnerTransition(coordinator, transition);
  }

  for (const pendingTransition of coordinator.expectedOwnerTransitions) {
    if (
      pendingTransition.sourceGeneration > transition.sourceGeneration &&
      pendingTransition.fromUserId === previousOwnerUserId
    ) {
      pendingTransition.fromUserId = toUserId;
    }
  }

  return true;
}

function enqueueAuthActionCommit<T>(
  coordinator: AuthActionCoordinator,
  generation: number,
  operation: () => Promise<T>,
  options: { terminal?: boolean } = {},
): Promise<AuthActionCommitResult<T>> {
  const result = coordinator.queue.then(async () => {
    if (!options.terminal && !isAuthActionCurrent(coordinator, generation)) {
      return { status: 'superseded' } as const;
    }

    return { status: 'committed', value: await operation() } as const;
  });
  coordinator.queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function removeLocalSupabaseSessionAfterRemoteSignOutFailure() {
  try {
    const localSignOutResult = await supabase.auth.signOut({ scope: 'local' });

    if (localSignOutResult?.error) {
      logger.error('auth', 'Local Supabase sign-out failed after a remote sign-out failure.', {
        error: localSignOutResult.error.name,
      });
    }
  } catch (error) {
    logger.error('auth', 'Local Supabase sign-out threw after a remote sign-out failure.', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}

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
  const authActionCoordinator = useRef<AuthActionCoordinator>({
    expectedOwnerTransitions: [],
    generation: 0,
    ownerUserId: user?.id ?? null,
    queue: Promise.resolve(),
  }).current;
  const renderedOwnerUserId = user?.id ?? null;

  if (authActionCoordinator.ownerUserId !== renderedOwnerUserId) {
    const isExpectedTransition = consumeExpectedAuthOwnerTransition(
      authActionCoordinator,
      renderedOwnerUserId,
    );
    authActionCoordinator.ownerUserId = renderedOwnerUserId;

    if (!isExpectedTransition) {
      authActionCoordinator.expectedOwnerTransitions.length = 0;
      authActionCoordinator.generation += 1;
    }
  }

  const refreshUser = useCallback(async () => {
    const generation = authActionCoordinator.generation;
    const commitResult = await enqueueAuthActionCommit(
      authActionCoordinator,
      generation,
      async () => {
        const { data, error } = await supabase.auth.refreshSession();

        if (!isAuthActionCurrent(authActionCoordinator, generation)) {
          return;
        }

        if (isAuthSessionMissingError(error) || (!error && !data.session)) {
          const expectedTransition = beginExpectedAuthOwnerTransition(
            authActionCoordinator,
            generation,
            null,
          );
          let signOutResult;

          try {
            signOutResult = await supabase.auth.signOut({ scope: 'local' });
          } catch (signOutError) {
            finishExpectedAuthOwnerTransition(authActionCoordinator, expectedTransition);
            throw signOutError;
          }

          if (signOutResult?.error) {
            finishExpectedAuthOwnerTransition(authActionCoordinator, expectedTransition);
            throw signOutResult.error;
          }

          // Local sign-out emits SIGNED_OUT, keeping fail-closed cleanup inside
          // the same lifecycle queue as every other auth transition.
          return;
        }

        if (error) {
          throw error;
        }

        // refreshSession emits TOKEN_REFRESHED. The lifecycle event queue owns
        // profile/cache/persistence work and rejects stale generations.
      },
    );

    if (commitResult.status === 'superseded') {
      return;
    }
  }, [authActionCoordinator]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const generation = beginAuthAction(authActionCoordinator);
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
        const commitResult = await enqueueAuthActionCommit(
          authActionCoordinator,
          generation,
          async () => {
            const expectedTransition = beginExpectedAuthOwnerTransition(
              authActionCoordinator,
              generation,
              ANY_AUTHENTICATED_OWNER,
            );

            try {
              const authResult = await supabase.auth.setSession({
                access_token: response.session.accessToken,
                refresh_token: response.session.refreshToken,
              });

              if (authResult.error || !authResult.data.user) {
                finishExpectedAuthOwnerTransition(authActionCoordinator, expectedTransition);
              } else {
                retargetExpectedAuthOwnerTransition(
                  authActionCoordinator,
                  expectedTransition,
                  authResult.data.user.id,
                );
              }

              return authResult;
            } catch (setSessionError) {
              finishExpectedAuthOwnerTransition(authActionCoordinator, expectedTransition);
              throw setSessionError;
            }
          },
        );

        if (commitResult.status === 'superseded') {
          return { success: false, code: 'unexpected' };
        }

        const { data, error } = commitResult.value;

        if (error || !data.session || !data.user) {
          return {
            success: false,
            code: 'unexpected',
            message: error?.message,
          };
        }

        // setSession publishes the auth event consumed by useAuthSessionLifecycle.
        // That lifecycle is the single owner of persistence and user hydration,
        // so an older login cannot bypass its generation/owner guards here.
        return { success: true };
      } catch (error) {
        return toAuthActionResult(error);
      }
    },
    [authActionCoordinator],
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
    const generation = beginAuthAction(authActionCoordinator);
    const userId = user?.id;

    const commitResult = await enqueueAuthActionCommit(
      authActionCoordinator,
      generation,
      async () => {
        let preparedPushCleanup: Awaited<ReturnType<
          typeof import('@/mobile/app/data/repositories/pushNotificationRepository').preparePushNotificationLogoutCleanup
        >> = null;
        let pushNotificationRepository: Awaited<ReturnType<typeof loadPushNotificationRepository>> | null = null;
        let remoteSignOutError: unknown;
        let localCleanupError: Error | null = null;

        // Preparation reads the active auth capability, so it belongs to the
        // same serialized commit as sign-out and local cleanup.
        if (userId) {
          try {
            pushNotificationRepository = await loadPushNotificationRepository();
            preparedPushCleanup = await pushNotificationRepository.preparePushNotificationLogoutCleanup();
          } catch (error) {
            logger.warn('auth', 'Push cleanup could not be prepared; logout was kept fail-closed.', {
              error: error instanceof Error ? error.name : 'unknown',
            });
            throw error;
          }
        }

        try {
          try {
            const [resolvedPushNotificationRepository, { unregisterSystemPushNotifications }] =
              await Promise.all([
                pushNotificationRepository ?? loadPushNotificationRepository(),
                loadSystemPushNotificationRepository(),
              ]);
            await Promise.all([
              resolvedPushNotificationRepository.unregisterAllPushNotifications(preparedPushCleanup).catch((err) => {
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
            beginExpectedAuthOwnerTransition(
              authActionCoordinator,
              generation,
              null,
            );
            const signOutResult = await supabase.auth.signOut();

            if (signOutResult?.error) {
              remoteSignOutError = signOutResult.error;
              await removeLocalSupabaseSessionAfterRemoteSignOutFailure();
            }
          } catch (error) {
            remoteSignOutError = error;
            await removeLocalSupabaseSessionAfterRemoteSignOutFailure();
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
      },
      { terminal: true },
    );

    if (commitResult.status === 'superseded') {
      return;
    }
  }, [authActionCoordinator, setUser, user?.id]);

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
