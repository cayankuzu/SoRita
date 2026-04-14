import React from 'react';
import { createBrowserRouter, createHashRouter, Navigate, RouterProvider } from 'react-router';

import { Layout } from '@/app/app-shell/chrome/AppLayout';
import { AuthScreen } from '@/app/features/auth/public/screens';
import { ExploreScreen } from '@/app/features/explore/public/screens';
import { HomeScreen } from '@/app/features/home/public/screens';
import { ListDetailScreen } from '@/app/features/lists/public/screens';
import { MapScreen } from '@/app/features/map/public/screens';
import { NotificationsScreen } from '@/app/features/notifications/public/screens';
import { ProfileScreen, UserProfileScreen } from '@/app/features/profile/public/screens';
import { SettingsScreen } from '@/app/features/settings/public/screens';

const createAppRouter =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? createHashRouter
    : createBrowserRouter;

const router = createAppRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: AuthScreen },
      { path: 'home', Component: HomeScreen },
      { path: 'map', Component: MapScreen },
      { path: 'explore', Component: ExploreScreen },
      { path: 'profile', Component: ProfileScreen },
      { path: 'profile/:userId', Component: UserProfileScreen },
      { path: 'list/:listId', Component: ListDetailScreen },
      { path: 'notifications', Component: NotificationsScreen },
      { path: 'settings', Component: SettingsScreen },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function RootNavigator() {
  return <RouterProvider router={router} />;
}
