import React from 'react';
import { Camera } from 'lucide-react-native';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { PROFILE_INTEREST_OPTIONS } from '@/mobile/app/catalog/profileInterests';
import { AuthImagePicker, AuthStepDots } from '@/mobile/app/features/auth/public/components';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { MultiSelectChipField } from '@/mobile/app/shared/components/ui/MultiSelectChipField';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';
import {
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type EditProfileStep = {
  title: string;
  description: string;
};

type SettingsEditProfileFlowProps = {
  canContinueEdit: boolean;
  clearCoverPhoto: () => void;
  clearProfilePhoto: () => void;
  coverPhoto?: string;
  editBio: string;
  editInterests: string[];
  editName: string;
  editStep: number;
  editUsername: string;
  isSavingProfile: boolean;
  onBack: () => void;
  onCancel: () => void;
  onChangeBio: (value: string) => void;
  onChangeName: (value: string) => void;
  onChangeUsername: (value: string) => void;
  onNext: () => void;
  onRefresh: () => void;
  onSave: () => void;
  profilePhoto?: string;
  refreshing: boolean;
  saveProfileMessage?: string;
  selectCoverPhoto: () => void;
  selectProfilePhoto: () => void;
  steps: readonly EditProfileStep[];
  toggleInterest: (value: string) => void;
  usernameHelper?: string;
  usernameHelperTone?: 'muted' | 'danger' | 'success';
};

export function SettingsEditProfileFlow({
  canContinueEdit,
  clearCoverPhoto,
  clearProfilePhoto,
  coverPhoto,
  editBio,
  editInterests,
  editName,
  editStep,
  editUsername,
  isSavingProfile,
  onBack,
  onCancel,
  onChangeBio,
  onChangeName,
  onChangeUsername,
  onNext,
  onRefresh,
  onSave,
  profilePhoto,
  refreshing,
  saveProfileMessage,
  selectCoverPhoto,
  selectProfilePhoto,
  steps,
  toggleInterest,
  usernameHelper,
  usernameHelperTone,
}: SettingsEditProfileFlowProps) {
  const currentEditStep = steps[editStep];
  const isLastEditStep = editStep === steps.length - 1;
  const usernameInputRef = React.useRef<TextInput>(null);
  const bioInputRef = React.useRef<TextInput>(null);
  // The pull-to-refresh stays attached while saving and ignores the pull:
  // removing it rebuilt the form's scroll view on Android, dropping focus
  // and jumping to the top the moment Save was tapped.
  const handleRefresh = React.useCallback(() => {
    if (!isSavingProfile) {
      onRefresh();
    }
  }, [isSavingProfile, onRefresh]);

  return (
    <Screen
      refreshing={!isSavingProfile && refreshing}
      onRefresh={handleRefresh}
      variant="settings"
    >
      <SettingsHeader
        title={tr.settings.editProfile.title}
        onBack={onBack}
        actionLabel={tr.common.cancel}
        onAction={onCancel}
      />

      <View style={styles.stepHeader}>
        <AuthStepDots current={editStep} total={steps.length} />
        <AppText accessibilityLiveRegion="polite" style={styles.stepCounter}>
          {tr.settings.editProfile.stepCounter(editStep + 1, steps.length)}
        </AppText>
      </View>

      <View style={styles.stepCopy}>
        <AppText accessibilityRole="header" style={styles.stepTitle}>{currentEditStep.title}</AppText>
        <AppText style={styles.stepDescription}>{currentEditStep.description}</AppText>
      </View>

      {editStep === 0 ? (
        <View style={styles.form}>
          <TextField
            label={tr.settings.editProfile.nameLabel}
            value={editName}
            onChangeText={onChangeName}
            editable={!isSavingProfile}
            maxLength={USER_NAME_MAX_LENGTH}
            returnKeyType="next"
            onSubmitEditing={() => usernameInputRef.current?.focus()}
          />
          <TextField
            ref={usernameInputRef}
            label={tr.settings.editProfile.usernameLabel}
            value={editUsername}
            onChangeText={onChangeUsername}
            editable={!isSavingProfile}
            autoCapitalize="none"
            helper={usernameHelper}
            helperTone={usernameHelperTone}
            maxLength={USERNAME_MAX_LENGTH}
            returnKeyType="next"
            onSubmitEditing={() => bioInputRef.current?.focus()}
          />
          <TextField
            ref={bioInputRef}
            label={tr.settings.editProfile.bioLabel}
            value={editBio}
            onChangeText={onChangeBio}
            editable={!isSavingProfile}
            multilineRows={4}
            placeholder={tr.settings.editProfile.bioPlaceholder}
            maxLength={USER_BIO_MAX_LENGTH}
          />
        </View>
      ) : null}

      {editStep === 1 ? (
        <View style={styles.form}>
          <MultiSelectChipField
            options={PROFILE_INTEREST_OPTIONS}
            selectedValues={editInterests}
            onToggle={toggleInterest}
            disabled={isSavingProfile}
          />

          <AppText accessibilityLiveRegion="polite" style={styles.selectionMeta}>
            {tr.settings.editProfile.interestsSelection(editInterests.length)}
          </AppText>
        </View>
      ) : null}

      {editStep === 2 ? (
        <View
          accessibilityElementsHidden={isSavingProfile}
          importantForAccessibility={isSavingProfile ? 'no-hide-descendants' : 'auto'}
          pointerEvents={isSavingProfile ? 'none' : 'auto'}
          style={styles.form}
        >
          <View style={styles.photoSection}>
            <AuthImagePicker
              uri={profilePhoto}
              shape="circle"
              placeholderIcon={<Camera color={colors.textSoft} size={iconSize.lg} />}
              placeholderText={tr.settings.editProfile.profilePhoto}
              helperText={tr.settings.editProfile.profilePhotoHelper}
              onPress={selectProfilePhoto}
              onClear={clearProfilePhoto}
            />
          </View>

          <AuthImagePicker
            uri={coverPhoto}
            shape="cover"
            placeholderIcon={<Camera color={colors.textSoft} size={iconSize.md} />}
            placeholderText={tr.settings.editProfile.coverPhoto}
            helperText={tr.settings.editProfile.coverPhotoHelper}
            onPress={selectCoverPhoto}
            onClear={clearCoverPhoto}
          />
        </View>
      ) : null}

      {isSavingProfile ? (
        <View
          accessibilityLabel={saveProfileMessage || tr.settings.editProfile.saveInFlight}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
          style={styles.loadingCard}
        >
          <ActivityIndicator color={colors.primary} />
          <View style={styles.loadingCardBody}>
            <AppText style={styles.loadingCardTitle}>{tr.settings.editProfile.saveInFlightTitle}</AppText>
            <AppText style={styles.loadingCardText}>
              {saveProfileMessage || tr.settings.editProfile.saveInFlight}
            </AppText>
          </View>
        </View>
      ) : null}

      <View style={styles.stepActions}>
        {editStep > 0 ? (
          <PrimaryButton
            title={tr.common.back}
            variant="secondary"
            onPress={onBack}
            disabled={isSavingProfile}
            style={styles.stepButton}
          />
        ) : null}

        <PrimaryButton
          title={isLastEditStep ? tr.common.save : tr.settings.editProfile.stepNext}
          onPress={() => {
            if (isLastEditStep) {
              onSave();
              return;
            }

            onNext();
          }}
          disabled={!canContinueEdit || isSavingProfile}
          loading={isSavingProfile}
          style={styles.stepButton}
        />
      </View>
    </Screen>
  );
}
