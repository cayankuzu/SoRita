export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  ListDetail: { listId: string; placeId?: string } | undefined;
  UserProfile: { userId: string };
  Notifications: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Map: undefined;
  Profile: undefined;
};
