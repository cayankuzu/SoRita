import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react-native';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import { useAuthActions } from '@/mobile/app/app-shell/auth/session/useAuthActions';
import { useAuthSessionLifecycle } from '@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle';
import type { User } from '@/mobile/app/data/contracts/entities';
import { setAnalyticsUserId } from '@/mobile/app/platform/analytics/analyticsEvents';

export type { AuthActionResult, RegisterData } from '@/mobile/app/app-shell/auth/authTypes';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);

  useAuthSessionLifecycle({ setBooted, setUser });

  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id });
      setAnalyticsUserId(user.id);
    } else {
      Sentry.setUser(null);
      setAnalyticsUserId(null);
    }
  }, [user]);

  const authActions = useAuthActions({ user, setUser });

  const value = useMemo<AuthContextType>(
    () => ({
      ...authActions,
      user,
      booted,
    }),
    [authActions, booted, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
