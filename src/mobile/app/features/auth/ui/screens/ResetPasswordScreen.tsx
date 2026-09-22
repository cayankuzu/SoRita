import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { Lock } from 'lucide-react-native';

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
import { resolvePasswordResetLinkAction } from '@/mobile/app/features/auth/application/passwordResetLinkState';
import { useIncomingAuthUrl } from '@/mobile/app/features/auth/application/useIncomingAuthUrl';
import { validateResetPasswordInput } from '@/mobile/app/features/auth/application/resetPasswordValidation';
import { AuthField } from '@/mobile/app/features/auth/ui/components/AuthField';
import { AuthPasswordRequirements } from '@/mobile/app/features/auth/ui/components/AuthPasswordRequirements';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, spacing, typography } from '@/mobile/app/shared/theme/tokens';

type ScreenState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'updating' }
  | { status: 'error'; message: string };

export function ResetPasswordScreen() {
  const navigation = useAppNavigation();
  const route = useRootStackRoute<'ResetPassword'>();
  const { refreshUser, user } = useAuth();
  const incoming = useIncomingAuthUrl();
  const payload = useMemo(() => {
    const parsedPayload = incoming.url ? parseAuthDeepLinkUrl(incoming.url) : null;
    return parsedPayload?.target === 'reset-password'
      ? parsedPayload
      : normalizeAuthRedirectParams(route.params, 'reset-password');
  }, [incoming.url, route.params]);
  const [screenState, setScreenState] = useState<ScreenState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const passwordConfirmRef = React.useRef<TextInput>(null);
  /** The single-use state token this screen has already spent. */
  const preparedStateRef = React.useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const fail = (message: string) => {
      if (active) {
        setScreenState({
          status: 'error',
          message: message === tr.auth.callback.passwordResetLinkInvalid
            ? message
            : tr.auth.resetPassword.startFailed,
        });
      }
    };

    const action = resolvePasswordResetLinkAction({
      linkingResolved: incoming.resolved,
      preparedState: preparedStateRef.current,
      state: payload.state,
    });

    if (action !== 'prepare') {
      if (action === 'fail') {
        fail(tr.auth.callback.passwordResetLinkInvalid);
      }

      return () => {
        active = false;
      };
    }

    preparedStateRef.current = payload.state ?? null;

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
  }, [incoming.resolved, payload]);

  const submitPassword = useCallback(async () => {
    const validation = validateResetPasswordInput(password, passwordConfirm);
    setPasswordError(validation.passwordError);
    setConfirmError(validation.confirmError);
    setSubmissionError('');

    if (validation.passwordError || validation.confirmError) {
      return;
    }

    setScreenState({ status: 'updating' });
    try {
      await updateRecoveredPassword(password);
    } catch {
      setSubmissionError(tr.auth.resetPassword.updateFailed);
      setScreenState({ status: 'ready' });
      return;
    }

    await refreshUser();
  }, [password, passwordConfirm, refreshUser]);

  if (screenState.status === 'loading') {
    return (
      <Screen
        variant="form"
        contentContainerStyle={styles.content}
      >
        <View
          accessibilityLabel={tr.auth.resetPassword.checkingLink}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
          accessible
          style={styles.centered}
        >
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText accessibilityRole="header" style={styles.title}>{tr.auth.resetPassword.checkingLink}</AppText>
        </View>
      </Screen>
    );
  }

  if (screenState.status === 'error') {
    return (
      <Screen variant="form" contentContainerStyle={styles.content}>
        <View style={styles.centered}>
          <View accessibilityLiveRegion="assertive" style={styles.card}>
            <AppText accessibilityRole="header" style={styles.title}>{tr.auth.resetPassword.errorTitle}</AppText>
            <AppText style={styles.description}>{screenState.message}</AppText>
            <PrimaryButton
              title={user ? tr.auth.resetPassword.backToApp : tr.auth.resetPassword.requestNewMail}
              onPress={() => {
                // Auth is only a registered route while signed out, so a signed
                // in user pressing this was left stuck on the error card.
                if (user) {
                  navigation.navigate('MainTabs');
                  return;
                }

                navigation.navigate('Auth', { initialView: 'forgotPassword' });
              }}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant="form" contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <AppText accessibilityRole="header" style={styles.title}>{tr.auth.resetPassword.title}</AppText>
        <AppText style={styles.description}>{tr.auth.resetPassword.description}</AppText>

        <AuthField
          label={tr.auth.resetPassword.newPasswordLabel}
          placeholder={tr.auth.resetPassword.newPasswordPlaceholder}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setPasswordError('');
            setSubmissionError('');
          }}
          autoComplete="new-password"
          editable={screenState.status !== 'updating'}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => passwordConfirmRef.current?.focus()}
          icon={<Lock color={colors.textMuted} size={14} />}
          status={passwordError
            ? { kind: 'invalid', message: passwordError }
            : { kind: 'idle', message: tr.auth.passwordHint.requirements }}
        />
        <AuthPasswordRequirements password={password} />
        <AuthField
          ref={passwordConfirmRef}
          label={tr.auth.resetPassword.newPasswordConfirmLabel}
          placeholder={tr.auth.resetPassword.newPasswordConfirmPlaceholder}
          value={passwordConfirm}
          onChangeText={(value) => {
            setPasswordConfirm(value);
            setConfirmError('');
            setSubmissionError('');
          }}
          autoComplete="new-password"
          editable={screenState.status !== 'updating'}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => {
            void submitPassword();
          }}
          icon={<Lock color={colors.textMuted} size={14} />}
          status={confirmError ? { kind: 'invalid', message: confirmError } : undefined}
        />
        {submissionError ? (
          <AppText
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
            style={styles.formError}
          >
            {submissionError}
          </AppText>
        ) : null}
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
    ...typography.dialogTitleText,
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    ...typography.bodyText,
    textAlign: 'center',
  },
  formError: {
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    ...typography.supportingLabelText,
    padding: spacing.md,
  },
});
