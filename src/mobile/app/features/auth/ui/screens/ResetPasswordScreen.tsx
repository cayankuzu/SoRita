import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import * as Linking from 'expo-linking';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useAppNavigation, useRootStackRoute } from '@/mobile/app/app-shell/navigation/navigation';
import {
  preparePasswordResetRedirect,
  updateRecoveredPassword,
} from '@/mobile/app/app-shell/auth/session/authRedirectHandlers';
import {
  normalizeAuthRedirectParams,
  parseAuthDeepLinkUrl,
} from '@/mobile/app/app-shell/auth/session/authRedirectState';
import { AuthField } from '@/mobile/app/features/auth/ui/components/AuthField';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type ScreenState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'updating' }
  | { status: 'error'; message: string };

export function ResetPasswordScreen() {
  const navigation = useAppNavigation();
  const route = useRootStackRoute<'ResetPassword'>();
  const { refreshUser } = useAuth();
  const incomingUrl = Linking.useURL();
  const payload = useMemo(() => {
    const parsedPayload = incomingUrl ? parseAuthDeepLinkUrl(incomingUrl) : null;
    return parsedPayload?.target === 'reset-password'
      ? parsedPayload
      : normalizeAuthRedirectParams(route.params, 'reset-password');
  }, [incomingUrl, route.params]);
  const [screenState, setScreenState] = useState<ScreenState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let active = true;

    const fail = (message: string) => {
      if (active) {
        setScreenState({ status: 'error', message });
      }
    };

    const preparePasswordReset = async () => {
      await preparePasswordResetRedirect(payload);
      if (active) {
        setScreenState({ status: 'ready' });
      }
    };

    void preparePasswordReset().catch((error) => {
      fail(error instanceof Error ? error.message : 'Sifre sifirlama baslatilamadi.');
    });

    return () => {
      active = false;
    };
  }, [payload]);

  const submitPassword = useCallback(async () => {
    if (password.length < 6) {
      setFormError('Yeni sifre en az 6 karakter olmali.');
      return;
    }

    if (password !== passwordConfirm) {
      setFormError('Sifreler eslesmiyor.');
      return;
    }

    setFormError('');
    setScreenState({ status: 'updating' });
    try {
      await updateRecoveredPassword(password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sifre guncellenemedi.');
      setScreenState({ status: 'ready' });
      return;
    }

    await refreshUser();
    navigation.navigate('Auth', { initialView: 'login' });
  }, [navigation, password, passwordConfirm, refreshUser]);

  if (screenState.status === 'loading') {
    return (
      <Screen scroll={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.title}>Sifirlama baglantisi kontrol ediliyor</Text>
        </View>
      </Screen>
    );
  }

  if (screenState.status === 'error') {
    return (
      <Screen scroll={false}>
        <View style={styles.centered}>
          <View style={styles.card}>
            <Text style={styles.title}>Sifre sifirlama acilamadi</Text>
            <Text style={styles.description}>{screenState.message}</Text>
            <PrimaryButton
              title="Yeni sifirlama maili iste"
              onPress={() => navigation.navigate('Auth', { initialView: 'forgotPassword' })}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Yeni sifreni belirle</Text>
        <Text style={styles.description}>Hesabina tekrar girebilmek icin guclu bir sifre sec.</Text>

        <AuthField
          label="Yeni sifre"
          placeholder="En az 6 karakter"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          icon={<Lock color={colors.textSoft} size={16} />}
        />
        <AuthField
          label="Yeni sifre tekrar"
          placeholder="Sifreni tekrar gir"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
          autoCapitalize="none"
          icon={<Lock color={colors.textSoft} size={16} />}
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <PrimaryButton
          title="Sifreyi guncelle"
          loading={screenState.status === 'updating'}
          onPress={submitPassword}
        />
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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
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
  formError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
