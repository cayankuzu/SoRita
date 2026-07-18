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

export function AuthCallbackScreen() {
  const navigation = useAppNavigation();
  const route = useRootStackRoute<'AuthCallback'>();
  const { refreshUser, user } = useAuth();
  const incomingUrl = Linking.useURL();
  const [screenState, setScreenState] = useState<ScreenState>({ status: 'loading' });
  const payload = useMemo(() => {
    const parsedPayload = incomingUrl ? parseAuthDeepLinkUrl(incomingUrl) : null;
    return parsedPayload?.target === 'auth/callback'
      ? parsedPayload
      : normalizeAuthRedirectParams(route.params, 'auth/callback');
  }, [incomingUrl, route.params]);

  useEffect(() => {
    let active = true;

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

    void completeSignup().catch((error) => {
      fail(error instanceof Error ? error.message : tr.auth.callback.failed);
    });

    return () => {
      active = false;
    };
  }, [payload, refreshUser]);

  useEffect(() => {
    if (screenState.status === 'success' && user) {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  }, [navigation, screenState.status, user]);

  if (screenState.status === 'loading' || screenState.status === 'success') {
    return (
      <Screen scroll={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.title}>{tr.auth.callback.loadingTitle}</Text>
          <Text style={styles.description}>{tr.auth.callback.loadingDescription}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.centered}>
        <View style={styles.errorCard}>
          <Text style={styles.title}>{tr.auth.callback.errorTitle}</Text>
          <Text style={styles.description}>{screenState.message}</Text>
          <PrimaryButton
            title={tr.auth.callback.backToLogin}
            onPress={() => navigation.navigate('Auth', { initialView: 'login' })}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorCard: {
    width: '100%',
    gap: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 18,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
