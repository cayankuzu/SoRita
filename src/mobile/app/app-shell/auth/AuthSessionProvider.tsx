import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import { useAuthActions } from '@/mobile/app/app-shell/auth/session/useAuthActions';
import { useAuthSessionLifecycle } from '@/mobile/app/app-shell/auth/session/useAuthSessionLifecycle';
import type { User } from '@/mobile/app/data/contracts/entities';
import { setAnalyticsUserId } from '@/mobile/app/platform/analytics/analyticsEvents';
import {
  setAnalyticsConsent,
  shouldClearAnalyticsConsentForAccountBoundary,
} from '@/mobile/app/platform/analytics/analyticsConsent';

export type { AuthActionResult, RegisterData } from '@/mobile/app/app-shell/auth/authTypes';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);
  const previousSettledAnalyticsUserId = useRef<string | null | undefined>(undefined);

  useAuthSessionLifecycle({ setBooted, setUser });

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (
      booted &&
      shouldClearAnalyticsConsentForAccountBoundary(
        previousSettledAnalyticsUserId.current,
        nextUserId,
      )
    ) {
      // The in-memory gate closes synchronously; persistence cleanup is best
      // effort and is retried on every logged-out boot.
      void setAnalyticsConsent(false);
    }
    if (booted) previousSettledAnalyticsUserId.current = nextUserId;

    if (user) {
      Sentry.setUser({ id: user.id });
      setAnalyticsUserId(user.id);
    } else {
      Sentry.setUser(null);
      setAnalyticsUserId(null);
    }
  }, [booted, user]);

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
