import type { StartupWarmupStage } from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { createDeferredScreen } from '@/mobile/app/app-shell/navigation/createDeferredScreen';

export function getWarmupStageForRoute(routeName?: string): StartupWarmupStage | null {
  switch (routeName) {
    case 'Home':
      return 'home';
    case 'Explore':
      return 'explore';
    case 'Map':
    case 'LocationPlaceCards':
      return 'map';
    case 'Profile':
      return 'profile';
    case 'Notifications':
      return 'notifications';
    default:
      return null;
  }
}

export const AppHeaderScreen = createDeferredScreen(
  () => require('@/mobile/app/app-shell/chrome/AppHeader').AppHeader,
);
export const AuthRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/auth/public/authScreen').AuthScreen,
);
export const AuthCallbackRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/auth/public/authCallbackScreen').AuthCallbackScreen,
);
export const ResetPasswordRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/auth/public/resetPasswordScreen').ResetPasswordScreen,
);
export const HomeRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/home/public/homeScreen').HomeScreen,
);
export const ExploreRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/explore/public/exploreScreen').ExploreScreen,
);
export const MapRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/map/public/mapScreen').MapScreen,
);
export const LocationPlaceCardsRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/map/public/locationPlaceCardsScreen').LocationPlaceCardsScreen,
);
export const ProfileRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/profile/public/profileScreen').ProfileScreen,
);
export const UserProfileRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/profile/public/userProfileScreen').UserProfileScreen,
);
export const ListDetailRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/lists/public/listDetailScreen').ListDetailScreen,
);
export const NotificationsRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/notifications/public/notificationsScreen').NotificationsScreen,
);
export const SettingsRouteScreen = createDeferredScreen(
  () => require('@/mobile/app/features/settings/public/settingsScreen').SettingsScreen,
);

const startupScreenPreloaders: Record<StartupWarmupStage, () => void> = {
  explore: ExploreRouteScreen.preload,
  home: HomeRouteScreen.preload,
  map: MapRouteScreen.preload,
  notifications: NotificationsRouteScreen.preload,
  profile: ProfileRouteScreen.preload,
};

export function preloadStartupScreen(stage: StartupWarmupStage) {
  startupScreenPreloaders[stage]();
}
