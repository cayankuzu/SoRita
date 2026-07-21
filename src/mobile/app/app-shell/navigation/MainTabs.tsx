import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Compass, Home, MapPinned, User2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import {
  AppHeaderScreen,
  ExploreRouteScreen,
  getWarmupStageForRoute,
  HomeRouteScreen,
  MapRouteScreen,
  preloadStartupScreen,
  ProfileRouteScreen,
} from '@/mobile/app/app-shell/navigation/routes';
import type { MainTabParamList } from '@/mobile/app/app-shell/navigation/types';
import {
  prioritizeStartupWarmupStage,
  recordStartupWarmupTransition,
  schedulePredictedStartupWarmup,
  startStartupDataWarmup,
  stopStartupDataWarmup,
  type StartupWarmupStage,
} from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { getPerformanceContext } from '@/mobile/app/shared/performance/performanceContext';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, layout, radius, typography } from '@/mobile/app/shared/theme/tokens';
import { markNavigationStarted } from '@/mobile/app/shared/performance/navigationPerformance';
import { runAfterNextPaint, waitForNextPaint } from '@/mobile/app/shared/utils/interaction';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const tabPressTimes = new Map<StartupWarmupStage, number>();
let activeTabStage: StartupWarmupStage | null = null;

function getTabLabel(routeName: keyof MainTabParamList) {
  switch (routeName) {
    case 'Home':
      return tr.navigation.home;
    case 'Map':
      return tr.navigation.map;
    case 'Explore':
      return tr.navigation.explore;
    case 'Profile':
      return tr.navigation.profile;
  }
}

function getTabIcon(
  routeName: keyof MainTabParamList,
  color: string,
  focused: boolean,
) {
  const icon = (() => {
  switch (routeName) {
    case 'Home':
      return <Home color={color} size={18} />;
    case 'Map':
      return <MapPinned color={color} size={18} />;
    case 'Explore':
      return <Compass color={color} size={18} />;
    case 'Profile':
      return <User2 color={color} size={18} />;
  }
  })();

  return <View style={[styles.tabIcon, focused ? styles.tabIconActive : null]}>{icon}</View>;
}

function prioritizeTab(stage: StartupWarmupStage) {
  return {
    tabPress: () => {
      tabPressTimes.set(stage, Date.now());
      markNavigationStarted(
        stage === 'home'
          ? 'Home'
          : stage === 'map'
            ? 'Map'
            : stage === 'explore'
              ? 'Explore'
              : 'Profile',
        'tab',
      );
      preloadStartupScreen(stage);
      prioritizeStartupWarmupStage(stage);
    },
    focus: () => {
      recordStartupWarmupTransition(activeTabStage, stage);
      activeTabStage = stage;
      schedulePredictedStartupWarmup(stage);
      const pressedAt = tabPressTimes.get(stage);

      if (pressedAt == null) {
        return;
      }

      tabPressTimes.delete(stage);
      trackEvent({
        name: 'tab_switch',
        params: {
          ...getPerformanceContext(),
          durationMs: Date.now() - pressedAt,
          screen: stage,
        },
      });
    },
  };
}

export function MainTabs() {
  const { bottom } = useSafeAreaInsets();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;
    const cancelStart = runAfterNextPaint(() => {
      const initialStage = getWarmupStageForRoute(
        rootNavigationRef.getCurrentRoute()?.name,
      );

      void startStartupDataWarmup({
        initialStage,
        isCancelled: () => cancelled,
        prepareStage: async (stage) => {
          await waitForNextPaint();

          if (!cancelled) {
            preloadStartupScreen(stage);
          }
        },
        queryClient,
        userId: user.id,
      });
    });

    return () => {
      cancelled = true;
      cancelStart();
      stopStartupDataWarmup(user.id);
    };
  }, [user?.id]);

  return (
    <Tabs.Navigator
      id="main-tabs"
      backBehavior="history"
      screenOptions={({ route }) => ({
        freezeOnBlur: true,
        headerShown: true,
        lazy: true,
        sceneContainerStyle: styles.scene,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, focused }) => getTabIcon(route.name, color, focused),
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: styles.tabItem,
        tabBarLabel: getTabLabel(route.name),
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: [
          styles.tabBar,
          {
            height: layout.tabBarHeight + bottom,
            paddingBottom: layout.tabBarPaddingBottom + bottom,
          },
        ],
      })}
    >
      <Tabs.Screen
        name="Home"
        component={HomeRouteScreen}
        listeners={prioritizeTab('home')}
        options={{ header: () => <AppHeaderScreen /> }}
      />
      <Tabs.Screen
        name="Map"
        component={MapRouteScreen}
        listeners={prioritizeTab('map')}
        options={{ header: () => <AppHeaderScreen /> }}
      />
      <Tabs.Screen
        name="Explore"
        component={ExploreRouteScreen}
        listeners={prioritizeTab('explore')}
        options={{ header: () => <AppHeaderScreen /> }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileRouteScreen}
        listeners={prioritizeTab('profile')}
        options={{ header: () => <AppHeaderScreen /> }}
      />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: colors.background,
  },
  tabBar: {
    paddingTop: layout.tabBarPaddingTop,
    backgroundColor: colors.surface,
    borderTopColor: colors.cardBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    minHeight: 44,
    borderRadius: radius.md,
  },
  tabLabel: {
    fontSize: typography.metadataText.fontSize,
    fontWeight: '700',
    lineHeight: typography.metadataText.lineHeight,
  },
  tabIcon: {
    width: 30,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primaryBg,
  },
});
