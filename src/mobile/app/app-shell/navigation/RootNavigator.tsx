import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { StyleSheet } from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  getStateFromPath,
  type InitialState,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { MainTabs } from '@/mobile/app/app-shell/navigation/MainTabs';
import { startAuthDeepLinkCapture } from '@/mobile/app/app-shell/auth/session/authDeepLinkUrl';
import {
  buildNavigationLinkingPrefixes,
  isSafeLinkPath,
} from '@/mobile/app/app-shell/navigation/linkingPrefixes';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import {
  AppHeaderScreen,
  AuthCallbackRouteScreen,
  AuthRouteScreen,
  getWarmupStageForRoute,
  HomeRouteScreen,
  ListDetailRouteScreen,
  LocationPlaceCardsRouteScreen,
  NotificationsRouteScreen,
  ResetPasswordRouteScreen,
  SettingsRouteScreen,
  UICatalogRouteScreen,
  UserProfileRouteScreen,
  preloadRouteScreen,
} from '@/mobile/app/app-shell/navigation/routes';
import type { RootStackParamList } from '@/mobile/app/app-shell/navigation/types';
import {
  clearPersistedNavigationState,
  getPersistedNavigationState,
  savePersistedNavigationState,
} from '@/mobile/app/platform/storage/navigationState';
import { sanitizePersistedNavigationState } from '@/mobile/app/app-shell/navigation/navigationStateValidation';
import { env } from '@/mobile/app/platform/config/env';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { registerSentryNavigationContainer } from '@/mobile/app/platform/observability/sentry';
import { AppFeedbackStack } from '@/mobile/app/app-shell/feedback/AppFeedbackStack';
import { prioritizeStartupWarmupStage } from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { scheduleDeferredTask } from '@/mobile/app/shared/utils/deferredTask';
import { NAVIGATION_STATE_RESTORE_BUDGET_MS } from '@/mobile/app/shared/performance/budgets';
import { markScreenVisible } from '@/mobile/app/shared/performance/navigationPerformance';
import { useMarkStartupShellReady } from '@/mobile/app/app-shell/startup/StartupShellReadyContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
// Phones only, upright only. The lock rides on the native stack rather than
// on the manifest and Info.plist so it reaches installed binaries over the
// air; react-native-screens applies it as each screen becomes active.
const ROOT_SCREEN_OPTIONS = { headerShown: false, orientation: 'portrait_up' } as const;
const APP_EXIT_DOUBLE_PRESS_WINDOW_MS = 1800;
const NAVIGATION_STATE_PERSIST_DEBOUNCE_MS = 700;
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: buildNavigationLinkingPrefixes(env.appScheme, env.appLinkDomain),
  config: {
    screens: {
      AuthCallback: 'auth/callback',
      ListDetail: 'lists/:listId',
      ResetPassword: 'reset-password',
      UICatalog: 'dev/ui-catalog',
    },
  },
  getStateFromPath: (path, options) =>
    isSafeLinkPath(path) ? getStateFromPath(path, options) : undefined,
};
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    border: colors.cardBorder,
    card: colors.surface,
    notification: colors.primary,
    primary: colors.primary,
    text: colors.text,
  },
};

type NestedRouteState = {
  index?: number;
  routes?: ReadonlyArray<{
    name?: string;
    state?: NestedRouteState;
  }>;
};

function getActiveRouteName(state?: InitialState) {
  let currentState = state as NestedRouteState | undefined;
  let routeName: string | undefined;

  while (currentState?.routes?.length) {
    const route = currentState.routes[currentState.index ?? 0];

    if (!route) {
      break;
    }

    routeName = route.name ?? routeName;
    currentState = route.state;
  }

  return routeName;
}

export function RootNavigator() {
  const { booted, user } = useAuth();
  const navigationOwnerUserId = user?.id ?? null;
  const markStartupShellReady = useMarkStartupShellReady();
  const lastExitAttemptAtRef = useRef(0);
  const pendingNavigationStateRef = useRef<InitialState | undefined>(undefined);
  const lastSavedNavigationStateJsonRef = useRef<string | null>(null);
  const navigationPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationPersistTaskRef = useRef<ReturnType<typeof scheduleDeferredTask> | null>(null);
  const [initialNavigationState, setInitialNavigationState] = useState<InitialState | undefined>();
  const [restoredNavigationOwnerUserId, setRestoredNavigationOwnerUserId] = useState<
    string | null | undefined
  >();
  const [navigationStateReady, setNavigationStateReady] = useState(false);
  const [initialScreenReady, setInitialScreenReady] = useState(false);
  const isNavigationOwnerReady =
    navigationStateReady && restoredNavigationOwnerUserId === navigationOwnerUserId;
  const ownerInitialNavigationState = isNavigationOwnerReady
    ? initialNavigationState
    : undefined;
  const sanitizedInitialNavigationState = React.useMemo(
    () => sanitizePersistedNavigationState(ownerInitialNavigationState, Boolean(user)),
    [ownerInitialNavigationState, user],
  );

  const prioritizeActiveRoute = React.useCallback(() => {
    if (!user?.id || !rootNavigationRef.isReady()) {
      return;
    }

    const activeRoute = rootNavigationRef.getCurrentRoute();
    const stage = getWarmupStageForRoute(activeRoute?.name);

    if (activeRoute) {
      markScreenVisible(activeRoute.name, activeRoute.key);
    }

    if (stage) {
      prioritizeStartupWarmupStage(stage);
    }
  }, [user?.id]);

  const cancelPendingNavigationStatePersist = React.useCallback(() => {
    if (navigationPersistTimeoutRef.current) {
      clearTimeout(navigationPersistTimeoutRef.current);
      navigationPersistTimeoutRef.current = null;
    }

    if (navigationPersistTaskRef.current) {
      navigationPersistTaskRef.current.cancel();
      navigationPersistTaskRef.current = null;
    }
  }, []);

  const persistLatestNavigationState = React.useCallback(() => {
    if (!navigationOwnerUserId) {
      return;
    }

    const nextState = pendingNavigationStateRef.current;
    const nextStateJson = nextState ? JSON.stringify(nextState) : null;

    if (nextStateJson === lastSavedNavigationStateJsonRef.current) {
      return;
    }

    lastSavedNavigationStateJsonRef.current = nextStateJson;
    void savePersistedNavigationState(navigationOwnerUserId, nextState);
  }, [navigationOwnerUserId]);

  const flushPendingNavigationStatePersist = React.useCallback(() => {
    cancelPendingNavigationStatePersist();
    persistLatestNavigationState();
  }, [cancelPendingNavigationStatePersist, persistLatestNavigationState]);

  const scheduleNavigationStatePersist = React.useCallback(
    (state: InitialState | undefined) => {
      pendingNavigationStateRef.current = state;

      cancelPendingNavigationStatePersist();
      navigationPersistTimeoutRef.current = setTimeout(() => {
        navigationPersistTimeoutRef.current = null;
        navigationPersistTaskRef.current = scheduleDeferredTask(() => {
          navigationPersistTaskRef.current = null;
          persistLatestNavigationState();
        });
      }, NAVIGATION_STATE_PERSIST_DEBOUNCE_MS);
    },
    [cancelPendingNavigationStatePersist, persistLatestNavigationState],
  );

  // Auth deep links must be captured from app start. A warm launch delivers the
  // link as a `url` event and navigates afterwards, so a listener registered by
  // the screen never sees it.
  useEffect(() => {
    startAuthDeepLinkCapture();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!rootNavigationRef.isReady()) {
        return false;
      }

      if (rootNavigationRef.canGoBack()) {
        return false;
      }

      const now = Date.now();

      if (now - lastExitAttemptAtRef.current <= APP_EXIT_DOUBLE_PRESS_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }

      lastExitAttemptAtRef.current = now;
      showToast(tr.system.exitPrompt, 'info');
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!booted || !isNavigationOwnerReady) {
      return;
    }

    if (user) {
      AppHeaderScreen.preload();
      const activeRoutePrepared = preloadRouteScreen(
        getActiveRouteName(sanitizedInitialNavigationState),
      );

      if (!activeRoutePrepared) {
        HomeRouteScreen.preload();
      }
    } else if (!preloadRouteScreen(getActiveRouteName(sanitizedInitialNavigationState))) {
      AuthRouteScreen.preload();
    }

    setInitialScreenReady(true);
  }, [booted, isNavigationOwnerReady, sanitizedInitialNavigationState, user]);

  useEffect(() => {
    if (!booted) {
      return;
    }

    let active = true;
    let fallbackElapsed = false;
    const ownerUserId = navigationOwnerUserId;
    cancelPendingNavigationStatePersist();
    pendingNavigationStateRef.current = undefined;
    lastSavedNavigationStateJsonRef.current = null;
    setInitialNavigationState(undefined);
    setRestoredNavigationOwnerUserId(undefined);
    setNavigationStateReady(false);
    setInitialScreenReady(false);

    const fallbackTimeout = setTimeout(() => {
      if (!active) {
        return;
      }

      fallbackElapsed = true;
      setInitialNavigationState(undefined);
      setRestoredNavigationOwnerUserId(ownerUserId);
      setNavigationStateReady(true);
    }, NAVIGATION_STATE_RESTORE_BUDGET_MS);

    const restoreNavigationState = ownerUserId
      ? getPersistedNavigationState(ownerUserId)
      : clearPersistedNavigationState().then(() => undefined);

    void restoreNavigationState
      .then((state) => {
        if (active && !fallbackElapsed) {
          lastSavedNavigationStateJsonRef.current = state ? JSON.stringify(state) : null;
          setInitialNavigationState(state);
          setRestoredNavigationOwnerUserId(ownerUserId);
        }
      })
      .finally(() => {
        clearTimeout(fallbackTimeout);

        if (active && !fallbackElapsed) {
          setNavigationStateReady(true);
        }
      });

    return () => {
      active = false;
      clearTimeout(fallbackTimeout);
    };
  }, [booted, cancelPendingNavigationStatePersist, navigationOwnerUserId]);

  useEffect(() => {
    if (
      !navigationOwnerUserId ||
      !isNavigationOwnerReady ||
      !ownerInitialNavigationState ||
      sanitizedInitialNavigationState
    ) {
      return;
    }

    void clearPersistedNavigationState(navigationOwnerUserId);
  }, [
    isNavigationOwnerReady,
    navigationOwnerUserId,
    ownerInitialNavigationState,
    sanitizedInitialNavigationState,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        prioritizeActiveRoute();
        return;
      }

      flushPendingNavigationStatePersist();
    });

    return () => {
      subscription.remove();
      flushPendingNavigationStatePersist();
    };
  }, [flushPendingNavigationStatePersist, prioritizeActiveRoute]);

  const canRenderNavigation = booted && isNavigationOwnerReady && initialScreenReady;

  return (
    <View style={styles.container}>
      {canRenderNavigation ? (
        <NavigationContainer
          key={`${navigationOwnerUserId ?? 'guest'}-${sanitizedInitialNavigationState ? 'persisted' : 'fresh'}`}
          initialState={sanitizedInitialNavigationState}
          linking={linking}
          ref={rootNavigationRef}
          theme={navigationTheme}
          onReady={() => {
            if (rootNavigationRef.isReady()) {
              registerSentryNavigationContainer(rootNavigationRef);
            }

            prioritizeActiveRoute();
            markStartupShellReady();
          }}
          onStateChange={(state) => {
            prioritizeActiveRoute();

            if (!user) {
              return;
            }

            scheduleNavigationStatePersist(state);
          }}
        >
          <View style={styles.navigationShell}>
            <AppFeedbackStack />
            <View style={styles.stackShell}>
              <Stack.Navigator id="root-stack" screenOptions={ROOT_SCREEN_OPTIONS}>
                {user ? (
                  <Stack.Screen name="MainTabs" component={MainTabs} />
                ) : (
                  <Stack.Screen name="Auth" component={AuthRouteScreen} />
                )}
                {user ? <Stack.Screen name="ListDetail" component={ListDetailRouteScreen} /> : null}
                {user ? (
                  <Stack.Screen
                    name="LocationPlaceCards"
                    component={LocationPlaceCardsRouteScreen}
                  />
                ) : null}
                {user ? <Stack.Screen name="UserProfile" component={UserProfileRouteScreen} /> : null}
                {user ? <Stack.Screen name="Notifications" component={NotificationsRouteScreen} /> : null}
                {user ? <Stack.Screen name="Settings" component={SettingsRouteScreen} /> : null}
                {UICatalogRouteScreen ? (
                  <Stack.Screen name="UICatalog" component={UICatalogRouteScreen} />
                ) : null}
                <Stack.Screen name="AuthCallback" component={AuthCallbackRouteScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordRouteScreen} />
              </Stack.Navigator>
            </View>
          </View>
        </NavigationContainer>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navigationShell: {
    flex: 1,
  },
  stackShell: {
    flex: 1,
  },
});

