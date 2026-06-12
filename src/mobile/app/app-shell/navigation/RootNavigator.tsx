import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { StyleSheet } from 'react-native';
import {
  DefaultTheme,
  createNavigationContainerRef,
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Compass, Heart, Home, MapPinned, User2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import type { MainTabParamList, RootStackParamList } from '@/mobile/app/app-shell/navigation/types';
import { AppSplashScreen } from '@/mobile/app/app-shell/startup/AppSplashScreen';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { registerSentryNavigationContainer } from '@/mobile/app/platform/observability/sentry';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const APP_EXIT_DOUBLE_PRESS_WINDOW_MS = 1800;
const MINIMUM_SPLASH_DURATION_MS = 1200;

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['sorita://'],
  config: {
    screens: {
      AuthCallback: 'auth/callback',
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

function BootRouteScreen() {
  return <View style={styles.bootScreen} />;
}

function MainTabs() {
  const { bottom } = useSafeAreaInsets();
  const bottomInset = Math.max(bottom, Platform.OS === 'android' ? 12 : 0);

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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarStyle: {
          height: layout.tabBarHeight + bottomInset,
          paddingBottom: layout.tabBarPaddingBottom + bottomInset,
          paddingTop: layout.tabBarPaddingTop,
          backgroundColor: colors.surface,
          borderTopColor: colors.cardBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        // React Native Maps instances in the tab screens can lose marker/camera state
        // after Android freeze/unfreeze cycles, so keep these tabs live.
        freezeOnBlur: false,
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
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);

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
      showToast('Uygulamadan cikmak icin bir daha basin', 'info');
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, MINIMUM_SPLASH_DURATION_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const showSplashOverlay = !booted || !minimumSplashElapsed;

  return (
    <View style={styles.container}>
      <NavigationContainer
        linking={linking}
        ref={rootNavigationRef}
        theme={navigationTheme}
        onReady={() => {
          if (rootNavigationRef.isReady()) {
            registerSentryNavigationContainer(rootNavigationRef);
          }
        }}
      >
        <Stack.Navigator id="root-stack" screenOptions={{ headerShown: false }}>
          {!booted ? (
            <Stack.Screen name="Boot" component={BootRouteScreen} />
          ) : user ? (
            <Stack.Screen name="MainTabs" component={MainTabs} />
          ) : (
            <Stack.Screen name="Auth" component={AuthRouteScreen} />
          )}
          {user ? <Stack.Screen name="ListDetail" component={ListDetailRouteScreen} /> : null}
          {user ? <Stack.Screen name="UserProfile" component={UserProfileRouteScreen} /> : null}
          {user ? <Stack.Screen name="Notifications" component={NotificationsRouteScreen} /> : null}
          {user ? <Stack.Screen name="Settings" component={SettingsRouteScreen} /> : null}
          <Stack.Screen name="AuthCallback" component={AuthCallbackRouteScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordRouteScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      {showSplashOverlay ? (
        <View pointerEvents="none" style={styles.splashOverlay}>
          <AppSplashScreen />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bootScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
