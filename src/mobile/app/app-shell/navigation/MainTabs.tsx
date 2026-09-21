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
  getAdjacentStartupWarmupStage,
  scheduleAdjacentStartupWarmup,
  startStartupDataWarmup,
  stopStartupDataWarmup,
  type StartupWarmupStage,
} from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { getPerformanceContext } from '@/mobile/app/shared/performance/performanceContext';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  layout,
  minTouchSize,
  radius,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { markNavigationStarted } from '@/mobile/app/shared/performance/navigationPerformance';
import { runAfterNextPaint, waitForNextPaint } from '@/mobile/app/shared/utils/interaction';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const tabPressTimes = new Map<StartupWarmupStage, number>();

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

function getTabIconGlyph(routeName: keyof MainTabParamList, color: string) {
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
}

function getTabIcon(routeName: keyof MainTabParamList, color: string, focused: boolean) {
  return (
    <View style={[styles.tabIcon, focused ? styles.tabIconActive : null]}>
      {getTabIconGlyph(routeName, color)}
    </View>
  );
}

/**
 * The bar paints a fixed 60dp box that holds 6 + 24 + 16 + 6 = 52dp at default
 * type, so the label has 8dp to grow before it pushes the icon off the bar -
 * which happens just past 1.5x, and both platforms offer 1.8x and 2x. Rendering
 * the label ourselves is what puts it under the app's chrome cap; a plain
 * `tabBarLabel` string is drawn by react-navigation's own uncapped Text.
 */
function getTabLabelNode(routeName: keyof MainTabParamList, color: string) {
  return (
    <AppText numberOfLines={1} scaleLimit="chrome" style={[styles.tabLabel, { color }]}>
      {getTabLabel(routeName)}
    </AppText>
  );
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
      prioritizeStartupWarmupStage(stage);
    },
    focus: () => {
      scheduleAdjacentStartupWarmup(stage);
      const adjacentStage = getAdjacentStartupWarmupStage(stage);

      if (adjacentStage) {
        runAfterNextPaint(() => preloadStartupScreen(adjacentStage));
      }
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

const tabListeners = {
  Home: prioritizeTab('home'),
  Map: prioritizeTab('map'),
  Explore: prioritizeTab('explore'),
  Profile: prioritizeTab('profile'),
} as const;

function renderAppHeader() {
  return <AppHeaderScreen />;
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
        tabBarLabel: ({ color }) => getTabLabelNode(route.name, color),
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
        listeners={tabListeners.Home}
        options={{ header: renderAppHeader }}
      />
      <Tabs.Screen
        name="Map"
        component={MapRouteScreen}
        listeners={tabListeners.Map}
        options={{ header: renderAppHeader }}
      />
      <Tabs.Screen
        name="Explore"
        component={ExploreRouteScreen}
        listeners={tabListeners.Explore}
        options={{ header: renderAppHeader }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileRouteScreen}
        listeners={tabListeners.Profile}
        options={{ header: renderAppHeader }}
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
    minHeight: minTouchSize,
    borderRadius: radius.md,
  },
  tabLabel: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
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
