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
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { PASSWORD_MIN_LENGTH } from '@/mobile/app/shared/validation/contentLimits';

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
      fail(error instanceof Error ? error.message : tr.auth.resetPassword.startFailed);
    });

    return () => {
      active = false;
    };
  }, [payload]);

  const submitPassword = useCallback(async () => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      setFormError(tr.auth.resetPassword.tooShort);
      return;
    }

    if (password !== passwordConfirm) {
      setFormError(tr.auth.resetPassword.mismatch);
      return;
    }

    setFormError('');
    setScreenState({ status: 'updating' });
    try {
      await updateRecoveredPassword(password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : tr.auth.resetPassword.updateFailed);
      setScreenState({ status: 'ready' });
      return;
    }

    await refreshUser();
    navigation.navigate('Auth', { initialView: 'login' });
  }, [navigation, password, passwordConfirm, refreshUser]);

  if (screenState.status === 'loading') {
    return (
      <Screen variant="form" scroll={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.title}>{tr.auth.resetPassword.checkingLink}</Text>
        </View>
      </Screen>
    );
  }

  if (screenState.status === 'error') {
    return (
      <Screen variant="form" scroll={false}>
        <View style={styles.centered}>
          <View style={styles.card}>
            <Text style={styles.title}>{tr.auth.resetPassword.errorTitle}</Text>
            <Text style={styles.description}>{screenState.message}</Text>
            <PrimaryButton
              title={tr.auth.resetPassword.requestNewMail}
              onPress={() => navigation.navigate('Auth', { initialView: 'forgotPassword' })}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant="form" contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{tr.auth.resetPassword.title}</Text>
        <Text style={styles.description}>{tr.auth.resetPassword.description}</Text>

        <AuthField
          label={tr.auth.resetPassword.newPasswordLabel}
          placeholder={tr.auth.resetPassword.newPasswordPlaceholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          icon={<Lock color={colors.textMuted} size={14} />}
        />
        <AuthField
          label={tr.auth.resetPassword.newPasswordConfirmLabel}
          placeholder={tr.auth.resetPassword.newPasswordConfirmPlaceholder}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
          autoCapitalize="none"
          icon={<Lock color={colors.textMuted} size={14} />}
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <PrimaryButton
          title={tr.auth.resetPassword.submit}
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
    gap: 10,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
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
  formError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
