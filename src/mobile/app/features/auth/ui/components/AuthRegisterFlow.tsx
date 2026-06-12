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
import { AuthField } from '@/mobile/app/features/auth/ui/components/AuthField';
import { AuthImagePicker } from '@/mobile/app/features/auth/ui/components/AuthImagePicker';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import { AuthStepDots } from '@/mobile/app/features/auth/ui/components/AuthStepDots';
import { ProfilePreviewSection } from '@/mobile/app/features/profile/public/components';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { MultiSelectChipField } from '@/mobile/app/shared/components/ui/MultiSelectChipField';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type RegisterStepItem = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

type AuthRegisterFlowProps = {
  canContinue: boolean;
  clearCoverPhoto: () => void;
  clearProfilePhoto: () => void;
  coverPhoto: string;
  emailHelper?: string;
  emailHelperTone?: 'muted' | 'danger' | 'success';
  goToLogin: () => void;
  goToNextRegisterStep: () => void;
  goToPreviousRegisterStep: () => void;
  handleRegister: () => void;
  handleRegisterBack: () => void;
  passwordHint?: string;
  profilePhoto: string;
  regBio: string;
  regEmail: string;
  regInterests: string[];
  regName: string;
  regPassword: string;
  regPasswordConfirm: string;
  regStep: number;
  regUsername: string;
  selectCoverPhoto: () => void;
  selectProfilePhoto: () => void;
  setRegBio: (value: string) => void;
  setRegEmail: (value: string) => void;
  setRegName: (value: string) => void;
  setRegPassword: (value: string) => void;
  setRegPasswordConfirm: (value: string) => void;
  steps: RegisterStepItem[];
  toggleInterest: (value: string) => void;
  updateRegisterUsername: (value: string) => void;
  usernameHelper?: string;
  usernameHelperTone?: 'muted' | 'danger' | 'success';
};

export function AuthRegisterFlow({
  canContinue,
  clearCoverPhoto,
  clearProfilePhoto,
  coverPhoto,
  emailHelper,
  emailHelperTone,
  goToLogin,
  goToNextRegisterStep,
  goToPreviousRegisterStep,
  handleRegister,
  handleRegisterBack,
  passwordHint,
  profilePhoto,
  regBio,
  regEmail,
  regInterests,
  regName,
  regPassword,
  regPasswordConfirm,
  regStep,
  regUsername,
  selectCoverPhoto,
  selectProfilePhoto,
  setRegBio,
  setRegEmail,
  setRegName,
  setRegPassword,
  setRegPasswordConfirm,
  steps,
  toggleInterest,
  updateRegisterUsername,
  usernameHelper,
  usernameHelperTone,
}: AuthRegisterFlowProps) {
  const currentStep = steps[regStep];
  const isLastStep = regStep === steps.length - 1;

  return (
    <Screen contentContainerStyle={styles.authScreen}>
      {isLastStep ? (
        <>
          <View style={styles.previewBackRow}>
            <InstantPressable onPress={goToPreviousRegisterStep} style={styles.backButton}>
              <ArrowLeft color={colors.textMuted} size={20} />
            </InstantPressable>
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
            <InstantPressable onPress={handleRegisterBack} style={styles.backButton}>
              <ArrowLeft color={colors.textMuted} size={20} />
            </InstantPressable>
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
            icon={<User color={colors.textSoft} size={16} />}
          />
          <AuthField
            label={tr.auth.register.usernameLabel}
            placeholder={tr.auth.register.usernamePlaceholder}
            value={regUsername}
            onChangeText={updateRegisterUsername}
            autoCapitalize="none"
            helper={usernameHelper}
            helperTone={usernameHelperTone}
            icon={<Text style={styles.atIcon}>@</Text>}
          />
          <TextField
            label="Biyografi"
            placeholder="Kendinden kisaca bahset..."
            value={regBio}
            onChangeText={setRegBio}
            multilineRows={4}
          />
          <Text style={styles.counterText}>{regBio.length}/150</Text>
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
            helper={emailHelper}
            helperTone={emailHelperTone}
            icon={<Mail color={colors.textSoft} size={16} />}
          />
          <AuthField
            label={tr.auth.register.passwordLabel}
            placeholder={tr.auth.register.passwordPlaceholder}
            value={regPassword}
            onChangeText={setRegPassword}
            secureTextEntry
            autoCapitalize="none"
            helper={passwordHint}
            icon={<Lock color={colors.textSoft} size={16} />}
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

          <AuthField
            label={tr.auth.register.passwordConfirmLabel}
            placeholder={tr.auth.register.passwordConfirmPlaceholder}
            value={regPasswordConfirm}
            onChangeText={setRegPasswordConfirm}
            secureTextEntry
            autoCapitalize="none"
            helper={
              regPasswordConfirm && regPassword !== regPasswordConfirm
                ? tr.auth.passwordHint.mismatch
                : undefined
            }
            helperTone={
              regPasswordConfirm && regPassword !== regPasswordConfirm ? 'danger' : 'muted'
            }
            icon={<Lock color={colors.textSoft} size={16} />}
          />
        </View>
      ) : null}

      {regStep === 2 ? (
        <View style={styles.formBlock}>
          <View style={styles.helperCard}>
            <Text style={styles.helperCardTitle}>Ilgi alanlarini sec</Text>
            <Text style={styles.helperCardText}>
              Sana uyan ilgi alanlarini sec. Bunlar profilinde rozet olarak gozukur.
            </Text>
          </View>

          <MultiSelectChipField
            options={PROFILE_INTEREST_OPTIONS}
            selectedValues={regInterests}
            onToggle={toggleInterest}
          />

          <Text style={styles.selectionMeta}>{regInterests.length} ilgi alani secildi</Text>
        </View>
      ) : null}

      {regStep === 3 ? (
        <View style={styles.formBlock}>
          <View style={styles.photoSection}>
            <AuthImagePicker
              uri={profilePhoto}
              shape="circle"
              placeholderIcon={<Camera color={colors.textSoft} size={26} />}
              placeholderText={tr.auth.register.profilePhotoAdd}
              helperText={tr.auth.register.profilePhotoHelper}
              onPress={selectProfilePhoto}
              onClear={clearProfilePhoto}
            />
          </View>

          <AuthImagePicker
            uri={coverPhoto}
            shape="cover"
            coverHeight={96}
            placeholderIcon={<Camera color={colors.textSoft} size={24} />}
            placeholderText={tr.auth.register.coverPhotoAdd}
            helperText="Kapak gorseli zorunlu degil"
            onPress={selectCoverPhoto}
            onClear={clearCoverPhoto}
          />
        </View>
      ) : null}

      {regStep === 4 ? (
        <ProfilePreviewSection
          name={regName.trim() || tr.auth.register.previewNameFallback}
          username={regUsername.trim() || tr.auth.register.usernamePlaceholder}
          bio={regBio.trim() || undefined}
          profilePhoto={profilePhoto}
          coverPhoto={coverPhoto}
          interestIds={regInterests}
        />
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
          <InstantPressable
            disabled={!canContinue}
            onPress={goToNextRegisterStep}
            style={[styles.primaryAction, !canContinue ? styles.primaryActionDisabled : null]}
          >
            <Text style={styles.primaryActionText}>{tr.auth.register.continue}</Text>
            <ArrowRight color={colors.onPrimary} size={16} />
          </InstantPressable>

          {regStep === 0 ? (
            <Text style={styles.footerText}>
              {tr.auth.register.hasAccount}{' '}
              <Text style={styles.footerLink} onPress={goToLogin}>
                {tr.auth.register.login}
              </Text>
            </Text>
          ) : null}
        </View>
      )}

      <AuthBrandFooter />
    </Screen>
  );
}
