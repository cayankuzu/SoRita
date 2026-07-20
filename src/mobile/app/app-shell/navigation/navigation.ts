import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';

import type {
  MainTabParamList,
  RootStackParamList,
} from '@/mobile/app/app-shell/navigation/types';
import { markNavigationStarted } from '@/mobile/app/shared/performance/navigationPerformance';

type RootStackRouteName = keyof RootStackParamList;
type AppRouteName = keyof RootStackParamList | keyof MainTabParamList;

type AppRouteParams<RouteName extends AppRouteName> =
  RouteName extends keyof RootStackParamList
    ? RootStackParamList[RouteName]
    : RouteName extends keyof MainTabParamList
      ? MainTabParamList[RouteName]
      : never;

type RootStackRouteArgs<RouteName extends RootStackRouteName> =
  undefined extends RootStackParamList[RouteName]
    ? [screenName: RouteName] | [screenName: RouteName, params: RootStackParamList[RouteName]]
    : [screenName: RouteName, params: RootStackParamList[RouteName]];

type AppRouteArgs<RouteName extends AppRouteName> =
  undefined extends AppRouteParams<RouteName>
    ? [screenName: RouteName] | [screenName: RouteName, params: AppRouteParams<RouteName>]
    : [screenName: RouteName, params: AppRouteParams<RouteName>];

export type AppNavigation = {
  goBack: () => void;
  getParent?: () => AppNavigation | undefined;
  navigate: <RouteName extends AppRouteName>(
    ...args: AppRouteArgs<RouteName>
  ) => void;
  push?: <RouteName extends RootStackRouteName>(
    ...args: RootStackRouteArgs<RouteName>
  ) => void;
};

export function useAppNavigation() {
  return useNavigation<AppNavigation>();
}

export function useRootStackRoute<RouteName extends RootStackRouteName>() {
  return useRoute<RouteProp<RootStackParamList, RouteName>>();
}

export function openStackScreen<RouteName extends RootStackRouteName>(
  navigation: Pick<AppNavigation, 'getParent' | 'navigate' | 'push'> | null | undefined,
  ...args: RootStackRouteArgs<RouteName>
) {
  if (!navigation) {
    return;
  }

  markNavigationStarted(String(args[0]), 'stack');

  let current: Pick<AppNavigation, 'getParent' | 'navigate' | 'push'> | undefined | null = navigation;
  const visited = new Set<Pick<AppNavigation, 'getParent' | 'navigate' | 'push'>>();

  while (current && !visited.has(current)) {
    if (typeof current.push === 'function') {
      current.push(...args);
      return;
    }

    visited.add(current);
    current = typeof current.getParent === 'function' ? current.getParent() : undefined;
  }

  navigation.navigate(...args);
}
