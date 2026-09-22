import React from 'react';
import { AccessibilityInfo, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Lock,
  Mail,
  User,
} from 'lucide-react-native';

import { PROFILE_INTEREST_OPTIONS } from '@/mobile/app/catalog/profileInterests';
import { AuthBrandFooter } from '@/mobile/app/features/auth/ui/components/AuthBrandFooter';
import { AuthField, type AuthFieldStatus } from '@/mobile/app/features/auth/ui/components/AuthField';
import { AuthImagePicker } from '@/mobile/app/features/auth/ui/components/AuthImagePicker';
import { AuthPasswordRequirements } from '@/mobile/app/features/auth/ui/components/AuthPasswordRequirements';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import { AuthStepDots } from '@/mobile/app/features/auth/ui/components/AuthStepDots';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { MultiSelectChipField } from '@/mobile/app/shared/components/ui/MultiSelectChipField';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, hitSlopFor, iconSize } from '@/mobile/app/shared/theme/tokens';
import {
  EMAIL_MAX_LENGTH,
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';
import { useAuthLayoutMode } from '@/mobile/app/features/auth/ui/components/useAuthLayoutMode';

type RegisterStepItem = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

type AuthAvailabilityStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'invalid'
  | 'error';

type AuthRegisterFlowProps = {
  clearCoverPhoto: () => void;
  clearProfilePhoto: () => void;
  coverPhoto?: string;
  emailAvailabilityStatus?: AuthAvailabilityStatus;
  emailHelper?: string;
  emailHelperTone?: 'muted' | 'danger' | 'success';
  goToLogin: () => void;
  goToNextRegisterStep: () => void;
  goToPreviousRegisterStep: () => void;
  handleRegister: () => void;
  handleRegisterBack: () => void;
  passwordHint?: string;
  passwordHintTone?: 'muted' | 'danger' | 'success';
  profilePhoto?: string;
  registerFieldErrors?: Partial<Record<'email' | 'name' | 'password' | 'username', string>>;
  registerSubmissionError?: string;
  regBio: string;
  regEmail: string;
  regInterests: string[];
  regName: string;
  regPassword: string;
  regStep: number;
  regUsername: string;
  selectCoverPhoto: () => void;
  selectProfilePhoto: () => void;
  setRegBio: (value: string) => void;
  setRegEmail: (value: string) => void;
  setRegName: (value: string) => void;
  setRegPassword: (value: string) => void;
  steps: RegisterStepItem[];
  toggleInterest: (value: string) => void;
  updateRegisterUsername: (value: string) => void;
  usernameHelper?: string;
  usernameAvailabilityStatus?: AuthAvailabilityStatus;
  usernameHelperTone?: 'muted' | 'danger' | 'success';
};

function buildHelperFieldStatus(
  message?: string,
  tone: 'muted' | 'danger' | 'success' = 'muted',
): AuthFieldStatus | undefined {
  if (!message) {
    return undefined;
  }

  if (tone === 'danger') {
    return { kind: 'invalid', message };
  }

  if (tone === 'success') {
    return { kind: 'valid', message };
  }

  return { kind: 'idle', message };
}

function buildAvailabilityFieldStatus(params: {
  availabilityStatus?: AuthAvailabilityStatus;
  fieldError?: string;
  helper?: string;
  helperTone?: 'muted' | 'danger' | 'success';
}) {
  if (params.fieldError) {
    return { kind: 'invalid', message: params.fieldError } satisfies AuthFieldStatus;
  }

  if (params.availabilityStatus === 'checking' && params.helper) {
    return { kind: 'checking', message: params.helper } satisfies AuthFieldStatus;
  }

  if (params.availabilityStatus === 'error' && params.helper) {
    return { kind: 'server-error', message: params.helper } satisfies AuthFieldStatus;
  }

  return buildHelperFieldStatus(params.helper, params.helperTone);
}

type AuthRegisterHeaderProps = {
  compact: boolean;
  currentStep: RegisterStepItem;
  goToPreviousRegisterStep: () => void;
  handleRegisterBack: () => void;
  isLastStep: boolean;
  regStep: number;
  stepCount: number;
};

function AuthRegisterHeader({
  compact,
  currentStep,
  goToPreviousRegisterStep,
  handleRegisterBack,
  isLastStep,
  regStep,
  stepCount,
}: AuthRegisterHeaderProps) {
  if (isLastStep) {
    return (
      <>
        <View style={styles.previewBackRow}>
          <IconButton
            accessibilityLabel={tr.common.back}
            onPress={goToPreviousRegisterStep}
            style={styles.backButton}
          >
            <ArrowLeft color={colors.textMuted} size={iconSize.md} />
          </IconButton>
        </View>

        <View style={styles.stepHeader}>
          <AuthStepDots current={regStep} total={stepCount} />
          <AppText accessible={false} style={styles.stepCounter}>
            {tr.settings.editProfile.stepCounter(regStep + 1, stepCount)}
          </AppText>
        </View>

        <View style={styles.stepCopy}>
          <AppText accessibilityRole="header" style={styles.stepTitle}>{currentStep.title}</AppText>
          <AppText style={styles.stepDescription}>{currentStep.subtitle}</AppText>
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.registerTopBar}>
        <IconButton
          accessibilityLabel={tr.common.back}
          onPress={handleRegisterBack}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.textMuted} size={iconSize.md} />
        </IconButton>
        <View style={styles.stepProgress}>
          <AuthStepDots current={regStep} total={stepCount} />
          <AppText accessible={false} style={styles.stepCounter}>
            {tr.settings.editProfile.stepCounter(regStep + 1, stepCount)}
          </AppText>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={[styles.authBrandRow, compact ? styles.authBrandRowCompact : null]}>
        <SoRitaLogo size={compact ? 'lg' : 'xl'} />
      </View>

      <View style={[styles.headerBlock, compact ? styles.headerBlockCompact : null]}>
        <View style={styles.stepIconWrap}>{currentStep.icon}</View>
        <AppText accessibilityRole="header" style={styles.screenTitle}>{currentStep.title}</AppText>
        <AppText style={styles.screenSubtitle}>{currentStep.subtitle}</AppText>
      </View>
    </>
  );
}

export function AuthRegisterFlow({
  clearCoverPhoto,
  clearProfilePhoto,
  coverPhoto,
  emailAvailabilityStatus,
  emailHelper,
  emailHelperTone,
  goToLogin,
  goToNextRegisterStep,
  goToPreviousRegisterStep,
  handleRegister,
  handleRegisterBack,
  passwordHint,
  passwordHintTone = 'muted',
  profilePhoto,
  registerFieldErrors = {},
  registerSubmissionError,
  regBio,
  regEmail,
  regInterests,
  regName,
  regPassword,
  regStep,
  regUsername,
  selectCoverPhoto,
  selectProfilePhoto,
  setRegBio,
  setRegEmail,
  setRegName,
  setRegPassword,
  steps,
  toggleInterest,
  updateRegisterUsername,
  usernameHelper,
  usernameAvailabilityStatus,
  usernameHelperTone,
}: AuthRegisterFlowProps) {
  const currentStep = steps[regStep];
  const isLastStep = regStep === steps.length - 1;
  const compact = useAuthLayoutMode();
  const nameRef = React.useRef<TextInput | null>(null);
  const usernameRef = React.useRef<TextInput | null>(null);
  const bioRef = React.useRef<TextInput | null>(null);
  const emailRef = React.useRef<TextInput | null>(null);
  const passwordRef = React.useRef<TextInput | null>(null);
  const lastFocusedErrorRef = React.useRef('');

  React.useEffect(() => {
    const progressLabel = tr.settings.editProfile.stepCounter(regStep + 1, steps.length);
    AccessibilityInfo.announceForAccessibility(`${progressLabel}. ${currentStep.title}`);
  }, [currentStep.title, regStep, steps.length]);

  React.useEffect(() => {
    const firstError = regStep === 0
      ? registerFieldErrors.name
        ? { key: 'name', ref: nameRef }
        : registerFieldErrors.username
          ? { key: 'username', ref: usernameRef }
          : null
      : regStep === 1
        ? registerFieldErrors.email
          ? { key: 'email', ref: emailRef }
          : registerFieldErrors.password
            ? { key: 'password', ref: passwordRef }
            : null
        : null;

    if (!firstError) {
      lastFocusedErrorRef.current = '';
      return;
    }

    const signature = `${regStep}:${firstError.key}`;
    if (lastFocusedErrorRef.current === signature) {
      return;
    }

    lastFocusedErrorRef.current = signature;
    const timeout = setTimeout(() => firstError.ref.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [regStep, registerFieldErrors]);

  return (
    <Screen variant="form" contentContainerStyle={styles.authScreen}>
      <AuthRegisterHeader
        compact={compact}
        currentStep={currentStep}
        goToPreviousRegisterStep={goToPreviousRegisterStep}
        handleRegisterBack={handleRegisterBack}
        isLastStep={isLastStep}
        regStep={regStep}
        stepCount={steps.length}
      />

      {regStep === 0 ? (
        <View style={styles.formBlock}>
          <AuthField
            ref={nameRef}
            label={tr.auth.register.nameLabel}
            placeholder={tr.auth.register.namePlaceholder}
            value={regName}
            onChangeText={setRegName}
            autoComplete="name"
            textContentType="name"
            blurOnSubmit={false}
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
            icon={<User color={colors.textMuted} size={iconSize.sm} />}
            status={buildHelperFieldStatus(registerFieldErrors.name, 'danger')}
            maxLength={USER_NAME_MAX_LENGTH}
          />
          <AuthField
            ref={usernameRef}
            label={tr.auth.register.usernameLabel}
            placeholder={tr.auth.register.usernamePlaceholder}
            value={regUsername}
            onChangeText={updateRegisterUsername}
            autoComplete="username-new"
            autoCapitalize="none"
            textContentType="username"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => bioRef.current?.focus()}
            status={buildAvailabilityFieldStatus({
              availabilityStatus: usernameAvailabilityStatus,
              fieldError: registerFieldErrors.username,
              helper: usernameHelper,
              helperTone: usernameHelperTone,
            })}
            icon={<AppText style={styles.atIcon}>@</AppText>}
            maxLength={USERNAME_MAX_LENGTH}
          />
          <TextField
            ref={bioRef}
            label={tr.auth.register.bioLabel}
            placeholder={tr.auth.register.bioPlaceholder}
            value={regBio}
            onChangeText={setRegBio}
            autoComplete="off"
            multilineRows={4}
            blurOnSubmit
            returnKeyType="done"
            onSubmitEditing={goToNextRegisterStep}
            maxLength={USER_BIO_MAX_LENGTH}
          />
        </View>
      ) : null}

      {regStep === 1 ? (
        <View style={styles.formBlock}>
          <AuthField
            ref={emailRef}
            label={tr.auth.register.emailLabel}
            placeholder={tr.auth.register.emailPlaceholder}
            value={regEmail}
            onChangeText={setRegEmail}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            blurOnSubmit={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            status={buildAvailabilityFieldStatus({
              availabilityStatus: emailAvailabilityStatus,
              fieldError: registerFieldErrors.email,
              helper: emailHelper,
              helperTone: emailHelperTone,
            })}
            icon={<Mail color={colors.textMuted} size={iconSize.sm} />}
            maxLength={EMAIL_MAX_LENGTH}
          />
          <AuthField
            ref={passwordRef}
            label={tr.auth.register.passwordLabel}
            placeholder={tr.auth.register.passwordPlaceholder}
            value={regPassword}
            onChangeText={setRegPassword}
            autoComplete="new-password"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={goToNextRegisterStep}
            status={buildHelperFieldStatus(
              registerFieldErrors.password || passwordHint,
              registerFieldErrors.password ? 'danger' : passwordHintTone,
            )}
            icon={<Lock color={colors.textMuted} size={iconSize.sm} />}
          />

          <AuthPasswordRequirements password={regPassword} />
        </View>
      ) : null}

      {regStep === 2 ? (
        <View style={styles.formBlock}>
          <View style={styles.helperCard}>
            <AppText style={styles.helperCardTitle}>{tr.auth.register.interestsTitle}</AppText>
            <AppText style={styles.helperCardText}>{tr.auth.register.interestsDescription}</AppText>
          </View>

          <MultiSelectChipField
            options={PROFILE_INTEREST_OPTIONS}
            selectedValues={regInterests}
            onToggle={toggleInterest}
          />

          <AppText accessibilityLiveRegion="polite" style={styles.selectionMeta}>
            {tr.auth.register.interestsSelectedCount(regInterests.length)}
          </AppText>
        </View>
      ) : null}

      {regStep === 3 ? (
        <View style={styles.formBlock}>
          <View style={styles.photoSection}>
            <AuthImagePicker
              uri={profilePhoto}
              shape="circle"
              placeholderIcon={<Camera color={colors.textMuted} size={iconSize.lg} />}
              placeholderText={tr.auth.register.profilePhotoAdd}
              helperText={tr.auth.register.profilePhotoHelper}
              onPress={selectProfilePhoto}
              onClear={clearProfilePhoto}
            />
          </View>

          <AuthImagePicker
            uri={coverPhoto}
            shape="cover"
            placeholderIcon={<Camera color={colors.textMuted} size={iconSize.md} />}
            placeholderText={tr.auth.register.coverPhotoAdd}
            helperText={tr.auth.register.coverPhotoOptional}
            onPress={selectCoverPhoto}
            onClear={clearCoverPhoto}
          />
        </View>
      ) : null}

      {registerSubmissionError ? (
        <AppText
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={styles.formError}
        >
          {registerSubmissionError}
        </AppText>
      ) : null}

      {isLastStep ? (
        <View style={styles.stepActions}>
          <PrimaryButton
            title={tr.common.back}
            variant="secondary"
            onPress={goToPreviousRegisterStep}
            style={styles.stepButton}
          />
          <PrimaryButton
            title={tr.auth.register.createAccount}
            onPress={handleRegister}
            style={styles.stepButton}
          />
        </View>
      ) : (
        <View style={[styles.bottomActions, compact ? styles.bottomActionsCompact : null]}>
          <PrimaryButton
            icon={<ArrowRight color={colors.onPrimary} size={iconSize.sm} />}
            iconPosition="end"
            title={tr.auth.register.continue}
            onPress={goToNextRegisterStep}
          />

          {regStep === 0 ? (
            <View style={styles.footerRow}>
              <AppText style={styles.footerText}>{tr.auth.register.hasAccount}</AppText>
              <InstantPressable
                accessibilityLabel={tr.auth.register.login}
                hitSlop={hitSlopFor(44)}
                accessibilityRole="link"
                onPress={goToLogin}
                style={styles.footerLinkButton}
              >
                <AppText style={styles.footerLink}>{tr.auth.register.login}</AppText>
              </InstantPressable>
            </View>
          ) : null}
        </View>
      )}

      <AuthBrandFooter />
    </Screen>
  );
}
