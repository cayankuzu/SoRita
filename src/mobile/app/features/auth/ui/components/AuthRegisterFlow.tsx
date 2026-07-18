import React from 'react';
import { Text, View } from 'react-native';
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
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import { AuthStepDots } from '@/mobile/app/features/auth/ui/components/AuthStepDots';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { MultiSelectChipField } from '@/mobile/app/shared/components/ui/MultiSelectChipField';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  EMAIL_MAX_LENGTH,
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

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
  registerFieldErrors?: Partial<Record<'email' | 'interests' | 'name' | 'password' | 'username', string>>;
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

  return (
    <Screen variant="form" contentContainerStyle={styles.authScreen}>
      {isLastStep ? (
        <>
          <View style={styles.previewBackRow}>
            <IconButton
              accessibilityLabel={tr.common.back}
              onPress={goToPreviousRegisterStep}
              style={styles.backButton}
            >
              <ArrowLeft color={colors.textMuted} size={20} />
            </IconButton>
          </View>

          <View style={styles.stepHeader}>
            <AuthStepDots current={regStep} total={steps.length} />
            <Text style={styles.stepCounter}>
              {tr.settings.editProfile.stepCounter(regStep + 1, steps.length)}
            </Text>
          </View>

          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>{currentStep.title}</Text>
            <Text style={styles.stepDescription}>{currentStep.subtitle}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.registerTopBar}>
            <IconButton
              accessibilityLabel={tr.common.back}
              onPress={handleRegisterBack}
              style={styles.backButton}
            >
              <ArrowLeft color={colors.textMuted} size={20} />
            </IconButton>
            <AuthStepDots current={regStep} total={steps.length} />
            <View style={styles.spacer} />
          </View>

          <View style={styles.authBrandRow}>
            <SoRitaLogo size="xl" />
          </View>

          <View style={styles.headerBlock}>
            <View style={styles.stepIconWrap}>{currentStep.icon}</View>
            <Text style={styles.screenTitle}>{currentStep.title}</Text>
            <Text style={styles.screenSubtitle}>{currentStep.subtitle}</Text>
          </View>
        </>
      )}

      {regStep === 0 ? (
        <View style={styles.formBlock}>
          <AuthField
            label={tr.auth.register.nameLabel}
            placeholder={tr.auth.register.namePlaceholder}
            value={regName}
            onChangeText={setRegName}
            icon={<User color={colors.textMuted} size={16} />}
            status={buildHelperFieldStatus(registerFieldErrors.name, 'danger')}
            maxLength={USER_NAME_MAX_LENGTH}
          />
          <AuthField
            label={tr.auth.register.usernameLabel}
            placeholder={tr.auth.register.usernamePlaceholder}
            value={regUsername}
            onChangeText={updateRegisterUsername}
            autoCapitalize="none"
            status={buildAvailabilityFieldStatus({
              availabilityStatus: usernameAvailabilityStatus,
              fieldError: registerFieldErrors.username,
              helper: usernameHelper,
              helperTone: usernameHelperTone,
            })}
            icon={<Text style={styles.atIcon}>@</Text>}
            maxLength={USERNAME_MAX_LENGTH}
          />
          <TextField
            label={tr.auth.register.bioLabel}
            placeholder={tr.auth.register.bioPlaceholder}
            value={regBio}
            onChangeText={setRegBio}
            multilineRows={4}
            maxLength={USER_BIO_MAX_LENGTH}
          />
        </View>
      ) : null}

      {regStep === 1 ? (
        <View style={styles.formBlock}>
          <AuthField
            label={tr.auth.register.emailLabel}
            placeholder={tr.auth.register.emailPlaceholder}
            value={regEmail}
            onChangeText={setRegEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            status={buildAvailabilityFieldStatus({
              availabilityStatus: emailAvailabilityStatus,
              fieldError: registerFieldErrors.email,
              helper: emailHelper,
              helperTone: emailHelperTone,
            })}
            icon={<Mail color={colors.textMuted} size={16} />}
            maxLength={EMAIL_MAX_LENGTH}
          />
          <AuthField
            label={tr.auth.register.passwordLabel}
            placeholder={tr.auth.register.passwordPlaceholder}
            value={regPassword}
            onChangeText={setRegPassword}
            secureTextEntry
            autoCapitalize="none"
            status={buildHelperFieldStatus(
              registerFieldErrors.password || passwordHint,
              registerFieldErrors.password ? 'danger' : passwordHintTone,
            )}
            icon={<Lock color={colors.textMuted} size={16} />}
          />

          <View style={styles.passwordMeter}>
            {[1, 2, 3, 4].map((level) => (
              <View
                key={level}
                style={[
                  styles.passwordMeterItem,
                  regPassword.length >= level * 3
                    ? level <= 2
                      ? styles.passwordMeterWarm
                      : styles.passwordMeterStrong
                    : null,
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {regStep === 2 ? (
        <View style={styles.formBlock}>
          <View style={styles.helperCard}>
            <Text style={styles.helperCardTitle}>{tr.auth.register.interestsTitle}</Text>
            <Text style={styles.helperCardText}>{tr.auth.register.interestsDescription}</Text>
          </View>

          <MultiSelectChipField
            options={PROFILE_INTEREST_OPTIONS}
            selectedValues={regInterests}
            onToggle={toggleInterest}
          />

          <Text style={[styles.selectionMeta, registerFieldErrors.interests ? styles.selectionMetaError : null]}>
            {registerFieldErrors.interests || tr.auth.register.interestsSelectedCount(regInterests.length)}
          </Text>
        </View>
      ) : null}

      {regStep === 3 ? (
        <View style={styles.formBlock}>
          <View style={styles.photoSection}>
            <AuthImagePicker
              uri={profilePhoto}
              shape="circle"
              placeholderIcon={<Camera color={colors.textMuted} size={26} />}
              placeholderText={tr.auth.register.profilePhotoAdd}
              helperText={tr.auth.register.profilePhotoHelper}
              onPress={selectProfilePhoto}
              onClear={clearProfilePhoto}
            />
          </View>

          <AuthImagePicker
            uri={coverPhoto}
            shape="cover"
            placeholderIcon={<Camera color={colors.textMuted} size={24} />}
            placeholderText={tr.auth.register.coverPhotoAdd}
            helperText={tr.auth.register.coverPhotoOptional}
            onPress={selectCoverPhoto}
            onClear={clearCoverPhoto}
          />
        </View>
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
        <View style={styles.bottomActions}>
          <PrimaryButton
            icon={<ArrowRight color={colors.onPrimary} size={16} />}
            iconPosition="end"
            title={tr.auth.register.continue}
            onPress={goToNextRegisterStep}
          />

          {regStep === 0 ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>{tr.auth.register.hasAccount}</Text>
              <InstantPressable
                accessibilityLabel={tr.auth.register.login}
                accessibilityRole="link"
                onPress={goToLogin}
                style={styles.footerLinkButton}
              >
                <Text style={styles.footerLink}>{tr.auth.register.login}</Text>
              </InstantPressable>
            </View>
          ) : null}
        </View>
      )}

      <AuthBrandFooter />
    </Screen>
  );
}
