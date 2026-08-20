import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useAppNavigation, useRootStackRoute } from '@/mobile/app/app-shell/navigation/navigation';
import { completeSignupRedirect } from '@/mobile/app/app-shell/auth/session/authRedirectHandlers';
import {
  normalizeAuthRedirectParams,
  parseAuthDeepLinkUrl,
} from '@/mobile/app/app-shell/auth/session/authRedirectState';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type ScreenState =
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; message: string };

const AUTH_CALLBACK_TIMEOUT_MS = 15_000;

export function AuthCallbackScreen() {
  const navigation = useAppNavigation();
  const route = useRootStackRoute<'AuthCallback'>();
  const { refreshUser, user } = useAuth();
  const incomingUrl = Linking.useURL();
  const [screenState, setScreenState] = useState<ScreenState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const payload = useMemo(() => {
    const parsedPayload = incomingUrl ? parseAuthDeepLinkUrl(incomingUrl) : null;
    return parsedPayload?.target === 'auth/callback'
      ? parsedPayload
      : normalizeAuthRedirectParams(route.params, 'auth/callback');
  }, [incomingUrl, route.params]);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setScreenState({ status: 'loading' });

    const fail = (message: string) => {
      if (active) {
        setScreenState({ status: 'error', message });
      }
    };

    const completeSignup = async () => {
      await completeSignupRedirect(payload);
      await refreshUser();

      if (active) {
        setScreenState({ status: 'success' });
      }
    };

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(tr.auth.callback.timeout)), AUTH_CALLBACK_TIMEOUT_MS);
    });

    void Promise.race([completeSignup(), timeout]).catch((error) => {
      fail(error instanceof Error ? error.message : tr.auth.callback.failed);
    }).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [attempt, payload, refreshUser]);

  useEffect(() => {
    if (screenState.status === 'success' && user) {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  }, [navigation, screenState.status, user]);

  if (screenState.status === 'loading' || screenState.status === 'success') {
    return (
      <Screen scroll={false} variant="form">
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.title}>{tr.auth.callback.loadingTitle}</Text>
          <Text style={styles.description}>{tr.auth.callback.loadingDescription}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      variant="form"
      contentContainerStyle={styles.scrollableCenteredContent}
    >
      <View style={styles.centered}>
        <View style={styles.errorCard}>
          <Text style={styles.title}>{tr.auth.callback.errorTitle}</Text>
          <Text style={styles.description}>{screenState.message}</Text>
          <View style={styles.actions}>
            <PrimaryButton
              title={tr.auth.callback.retry}
              onPress={() => setAttempt((current) => current + 1)}
              style={styles.actionButton}
            />
            <PrimaryButton
              title={tr.auth.callback.backToLogin}
              variant="secondary"
              onPress={() => navigation.navigate('Auth', { initialView: 'login' })}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollableCenteredContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorCard: {
    width: '100%',
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
