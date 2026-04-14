import React, { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Compass, Heart, Home, MapPinned, User2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { AppHeader } from '@/mobile/app/app-shell/chrome/AppHeader';
import type { MainTabParamList, RootStackParamList } from '@/mobile/app/app-shell/navigation/types';
import { AppSplashScreen } from '@/mobile/app/app-shell/startup/AppSplashScreen';
import { AuthScreen } from '@/mobile/app/features/auth/public/screens';
import { ExploreScreen } from '@/mobile/app/features/explore/public/screens';
import { HomeScreen } from '@/mobile/app/features/home/public/screens';
import { ListDetailScreen } from '@/mobile/app/features/lists/public/screens';
import { MapScreen } from '@/mobile/app/features/map/public/screens';
import { NotificationsScreen } from '@/mobile/app/features/notifications/public/screens';
import { ProfileScreen, UserProfileScreen } from '@/mobile/app/features/profile/public/screens';
import { SettingsScreen } from '@/mobile/app/features/settings/public/screens';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const APP_EXIT_DOUBLE_PRESS_WINDOW_MS = 1800;

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();

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
        freezeOnBlur: Platform.OS === 'android',
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
      <Tabs.Screen name="Home" component={HomeScreen} options={{ header: () => <AppHeader /> }} />
      <Tabs.Screen name="Map" component={MapScreen} options={{ header: () => <AppHeader /> }} />
      <Tabs.Screen name="Explore" component={ExploreScreen} options={{ header: () => <AppHeader /> }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ header: () => <AppHeader /> }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { booted, user } = useAuth();
  const lastExitAttemptAtRef = useRef(0);

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

  if (!booted) {
    return <AppSplashScreen />;
  }

  return (
    <NavigationContainer ref={rootNavigationRef}>
      <Stack.Navigator id="root-stack" screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
        {user ? <Stack.Screen name="ListDetail" component={ListDetailScreen} /> : null}
        {user ? <Stack.Screen name="UserProfile" component={UserProfileScreen} /> : null}
        {user ? <Stack.Screen name="Notifications" component={NotificationsScreen} /> : null}
        {user ? <Stack.Screen name="Settings" component={SettingsScreen} /> : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
