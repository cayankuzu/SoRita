import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Map: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Boot: undefined;
  Auth: { initialView?: 'landing' | 'login' | 'register' | 'forgotPassword'; email?: string } | undefined;
  AuthCallback: Record<string, string | undefined> | undefined;
  ResetPassword: Record<string, string | undefined> | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ListDetail: { listId: string; placeId?: string } | undefined;
  UserProfile: { userId: string; allowBlockedView?: boolean };
  Notifications: undefined;
  Settings: undefined;
};
