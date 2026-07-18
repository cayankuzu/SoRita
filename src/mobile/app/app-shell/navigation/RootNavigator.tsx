import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { StyleSheet } from 'react-native';
import {
  DefaultTheme,
  createNavigationContainerRef,
  NavigationContainer,
  type InitialState,
  type LinkingOptions,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Compass, Heart, Home, MapPinned, User2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import type { MainTabParamList, RootStackParamList } from '@/mobile/app/app-shell/navigation/types';
import {
  clearPersistedNavigationState,
  getPersistedNavigationState,
  savePersistedNavigationState,
} from '@/mobile/app/platform/storage/navigationState';
import { sanitizePersistedNavigationState } from '@/mobile/app/app-shell/navigation/navigationStateValidation';
import { env } from '@/mobile/app/platform/config/env';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { registerSentryNavigationContainer } from '@/mobile/app/platform/observability/sentry';
import { AppProgressBannerHost } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { StartupSplashScreen } from '@/mobile/app/app-shell/startup/StartupSplashScreen';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { scheduleDeferredTask } from '@/mobile/app/shared/utils/deferredTask';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const APP_EXIT_DOUBLE_PRESS_WINDOW_MS = 1800;
const NAVIGATION_STATE_PERSIST_DEBOUNCE_MS = 700;
const NAVIGATION_STATE_RESTORE_FALLBACK_MS = 1_500;

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();
const authWebOrigin = env.authWebOrigin.trim().replace(/\/+$/, '');
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['sorita://', authWebOrigin],
  config: {
    screens: {
      AuthCallback: 'auth/callback',
      ListDetail: 'lists/:listId',
      ResetPassword: 'reset-password',
    },
  },
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

function createDeferredScreen<Props extends object>(loader: () => React.ComponentType<Props>) {
  return function DeferredScreen(props: Props) {
    const Component = loader();
    return <Component {...props} />;
  };
}

const AppHeaderScreen = createDeferredScreen(() => require('@/mobile/app/app-shell/chrome/AppHeader').AppHeader);
const AuthRouteScreen = createDeferredScreen(() => require('@/mobile/app/features/auth/public/screens').AuthScreen);
const AuthCallbackRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/auth/public/screens').AuthCallbackScreen,
);
const ResetPasswordRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/auth/public/screens').ResetPasswordScreen,
);
const HomeRouteScreen = createDeferredScreen(() => require('@/mobile/app/features/home/public/screens').HomeScreen);
const ExploreRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/explore/public/screens').ExploreScreen,
);
const MapRouteScreen = createDeferredScreen(() => require('@/mobile/app/features/map/public/screens').MapScreen);
const LocationPlaceCardsRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/map/public/screens').LocationPlaceCardsScreen,
);
const ProfileRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/profile/public/screens').ProfileScreen,
);
const UserProfileRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/profile/public/screens').UserProfileScreen,
);
const ListDetailRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/lists/public/screens').ListDetailScreen,
);
const NotificationsRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/notifications/public/screens').NotificationsScreen,
);
const SettingsRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/settings/public/screens').SettingsScreen,
);

function MainTabs() {
  const { bottom } = useSafeAreaInsets();
  const bottomInset = bottom;

  return (
    <Tabs.Navigator
      id="main-tabs"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: true,
        lazy: true,
        sceneContainerStyle: {
          backgroundColor: colors.background,
        },
        tabBarLabel:
          route.name === 'Home'
            ? tr.navigation.home
            : route.name === 'Map'
              ? tr.navigation.map
              : route.name === 'Explore'
                ? tr.navigation.explore
                : tr.navigation.profile,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          minHeight: 48,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          lineHeight: 14,
        },
        tabBarStyle: {
          height: layout.tabBarHeight + bottomInset,
          paddingBottom: layout.tabBarPaddingBottom + bottomInset,
          paddingTop: layout.tabBarPaddingTop,
          backgroundColor: colors.surface,
          borderTopColor: colors.cardBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        // Keep the full map tab live, but freeze the other tabs to reduce
        // background work during screen transitions and tab switches.
        freezeOnBlur: route.name !== 'Map',
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case 'Home':
              return <Home color={color} size={size} />;
            case 'Explore':
              return <Compass color={color} size={size} />;
            case 'Map':
              return <MapPinned color={color} size={size} />;
            case 'Profile':
              return <User2 color={color} size={size} />;
            default:
              return <Heart color={color} size={size} />;
          }
        },
      })}
    >
      <Tabs.Screen
        name="Home"
        component={HomeRouteScreen}
        options={{ header: () => <AppHeaderScreen /> }}
      />
      <Tabs.Screen
        name="Map"
        component={MapRouteScreen}
        options={{ header: () => <AppHeaderScreen /> }}
      />
      <Tabs.Screen
        name="Explore"
        component={ExploreRouteScreen}
        options={{ header: () => <AppHeaderScreen /> }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileRouteScreen}
        options={{ header: () => <AppHeaderScreen /> }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { booted, user } = useAuth();
  const lastExitAttemptAtRef = useRef(0);
  const pendingNavigationStateRef = useRef<InitialState | undefined>(undefined);
  const pendingNavigationStateJsonRef = useRef<string | null>(null);
  const lastSavedNavigationStateJsonRef = useRef<string | null>(null);
  const navigationPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationPersistTaskRef = useRef<ReturnType<typeof scheduleDeferredTask> | null>(null);
  const [initialNavigationState, setInitialNavigationState] = useState<InitialState | undefined>();
  const [navigationStateReady, setNavigationStateReady] = useState(false);
  const sanitizedInitialNavigationState = React.useMemo(
    () => sanitizePersistedNavigationState(initialNavigationState, Boolean(user)),
    [initialNavigationState, user],
  );
  const effectiveInitialNavigationState = sanitizedInitialNavigationState;

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
    const nextState = pendingNavigationStateRef.current;
    const nextStateJson = pendingNavigationStateJsonRef.current;

    if (nextStateJson === lastSavedNavigationStateJsonRef.current) {
      return;
    }

    lastSavedNavigationStateJsonRef.current = nextStateJson;
    void savePersistedNavigationState(nextState);
  }, []);

  const flushPendingNavigationStatePersist = React.useCallback(() => {
    cancelPendingNavigationStatePersist();
    persistLatestNavigationState();
  }, [cancelPendingNavigationStatePersist, persistLatestNavigationState]);

  const scheduleNavigationStatePersist = React.useCallback(
    (state: InitialState | undefined) => {
      const serializedState = state ? JSON.stringify(state) : null;

      pendingNavigationStateRef.current = state;
      pendingNavigationStateJsonRef.current = serializedState;

      if (serializedState === lastSavedNavigationStateJsonRef.current) {
        return;
      }

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
    let active = true;
    let fallbackElapsed = false;
    const fallbackTimeout = setTimeout(() => {
      if (!active) {
        return;
      }

      fallbackElapsed = true;
      setInitialNavigationState(undefined);
      setNavigationStateReady(true);
    }, NAVIGATION_STATE_RESTORE_FALLBACK_MS);

    void getPersistedNavigationState()
      .then((state) => {
        if (active && !fallbackElapsed) {
          lastSavedNavigationStateJsonRef.current = state ? JSON.stringify(state) : null;
          setInitialNavigationState(state);
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
  }, []);

  useEffect(() => {
    if (!navigationStateReady || !initialNavigationState || sanitizedInitialNavigationState) {
      return;
    }

    void clearPersistedNavigationState();
  }, [initialNavigationState, navigationStateReady, sanitizedInitialNavigationState]);

  useEffect(() => {
    if (!booted || user) {
      return;
    }

    cancelPendingNavigationStatePersist();
    pendingNavigationStateRef.current = undefined;
    pendingNavigationStateJsonRef.current = null;
    lastSavedNavigationStateJsonRef.current = null;
    void clearPersistedNavigationState();
  }, [booted, cancelPendingNavigationStatePersist, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        return;
      }

      flushPendingNavigationStatePersist();
    });

    return () => {
      subscription.remove();
      flushPendingNavigationStatePersist();
    };
  }, [flushPendingNavigationStatePersist]);

  const canRenderNavigation = navigationStateReady;

  return (
    <View style={styles.container}>
      {canRenderNavigation ? (
        <NavigationContainer
          key={`${user ? 'auth' : 'guest'}-${effectiveInitialNavigationState ? 'persisted' : 'fresh'}`}
          initialState={effectiveInitialNavigationState}
          linking={linking}
          ref={rootNavigationRef}
          theme={navigationTheme}
          onReady={() => {
            if (rootNavigationRef.isReady()) {
              registerSentryNavigationContainer(rootNavigationRef);
            }
          }}
          onStateChange={(state) => {
            if (!user) {
              return;
            }

            scheduleNavigationStatePersist(state);
          }}
        >
          <View style={styles.navigationShell}>
            <AppProgressBannerHost />
            <View style={styles.stackShell}>
              <Stack.Navigator id="root-stack" screenOptions={{ headerShown: false }}>
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
                <Stack.Screen name="AuthCallback" component={AuthCallbackRouteScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordRouteScreen} />
              </Stack.Navigator>
            </View>
          </View>
        </NavigationContainer>
      ) : (
        <StartupSplashScreen />
      )}
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
