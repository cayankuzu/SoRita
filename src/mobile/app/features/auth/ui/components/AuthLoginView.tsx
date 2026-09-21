import React from 'react';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';

import { AuthBrandFooter } from '@/mobile/app/features/auth/ui/components/AuthBrandFooter';
import { AuthField } from '@/mobile/app/features/auth/ui/components/AuthField';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { useAuthLayoutMode } from '@/mobile/app/features/auth/ui/components/useAuthLayoutMode';

type AuthLoginViewProps = {
  confirmationEmail?: string | null;
  error?: string;
  loginEmail: string;
  loginPassword: string;
  onBack: () => void;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onForgotPassword: () => void;
  onLogin: () => void | Promise<void>;
  onOpenRegister: () => void;
  onResendConfirmation: () => void;
};

export function AuthLoginView({
  confirmationEmail,
  error,
  loginEmail,
  loginPassword,
  onBack,
  onChangeEmail,
  onChangePassword,
  onForgotPassword,
  onLogin,
  onOpenRegister,
  onResendConfirmation,
}: AuthLoginViewProps) {
  const compact = useAuthLayoutMode();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const passwordRef = React.useRef<TextInput | null>(null);
  const scrollViewRef = React.useRef<ScrollView | null>(null);
  const keyboardScrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealPasswordActions = React.useCallback(() => {
    if (keyboardScrollTimerRef.current) {
      clearTimeout(keyboardScrollTimerRef.current);
    }

    keyboardScrollTimerRef.current = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      keyboardScrollTimerRef.current = null;
    }, 180);
  }, []);

  React.useEffect(
    () => () => {
      if (keyboardScrollTimerRef.current) {
        clearTimeout(keyboardScrollTimerRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <Screen
      variant="form"
      contentContainerStyle={styles.authScreen}
      scrollViewRef={scrollViewRef}
    >
      {compact && keyboardVisible ? null : (
        <View style={[styles.authBrandRow, compact ? styles.authBrandRowCompact : null]}>
          <SoRitaLogo size={compact ? 'lg' : 'xl'} />
        </View>
      )}

      <IconButton accessibilityLabel={tr.common.back} onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={18} />
      </IconButton>

      <View style={[styles.headerBlock, compact ? styles.headerBlockCompact : null]}>
        <AppText accessibilityRole="header" style={styles.screenTitle}>{tr.auth.login.title}</AppText>
        <AppText style={styles.screenSubtitle}>{tr.auth.login.subtitle}</AppText>
      </View>

      <View style={styles.formBlock}>
        {confirmationEmail ? (
          <View accessibilityLiveRegion="polite" style={styles.confirmationCard}>
            <AppText style={styles.confirmationTitle}>{tr.auth.login.confirmationTitle}</AppText>
            <AppText style={styles.confirmationText}>
              {tr.auth.login.confirmationText(confirmationEmail)}
            </AppText>
            <PrimaryButton
              title={tr.auth.login.resendConfirmation}
              variant="secondary"
              onPress={onResendConfirmation}
            />
          </View>
        ) : null}

        <AuthField
          label={tr.auth.login.emailLabel}
          placeholder={tr.auth.login.emailPlaceholder}
          value={loginEmail}
          onChangeText={onChangeEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="username"
          blurOnSubmit={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          icon={<Mail color={colors.textMuted} size={14} />}
        />
        <AuthField
          ref={passwordRef}
          label={tr.auth.login.passwordLabel}
          placeholder={tr.auth.login.passwordPlaceholder}
          value={loginPassword}
          onChangeText={onChangePassword}
          autoComplete="current-password"
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          onFocus={revealPasswordActions}
          returnKeyType="done"
          onSubmitEditing={() => onLogin()}
          icon={<Lock color={colors.textMuted} size={14} />}
        />
        <View style={styles.forgotPasswordRow}>
          <InstantPressable
            accessibilityLabel={tr.auth.login.forgotPassword}
            accessibilityRole="link"
            onPress={onForgotPassword}
            style={styles.footerLinkButton}
          >
            <AppText style={styles.footerLink}>{tr.auth.login.forgotPassword}</AppText>
          </InstantPressable>
        </View>
        {error ? (
          <AppText
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
            style={styles.formError}
          >
            {error}
          </AppText>
        ) : null}
        <PrimaryButton title={tr.auth.login.submit} onPress={onLogin} />
      </View>

      <View style={styles.footerRow}>
        <AppText style={styles.footerText}>{tr.auth.login.noAccount}</AppText>
        <InstantPressable
          accessibilityLabel={tr.auth.login.register}
          accessibilityRole="link"
          onPress={onOpenRegister}
          style={styles.footerLinkButton}
        >
          <AppText style={styles.footerLink}>{tr.auth.login.register}</AppText>
        </InstantPressable>
      </View>

      <AuthBrandFooter />
    </Screen>
  );
}
