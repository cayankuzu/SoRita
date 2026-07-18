import React from 'react';
import { Camera } from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';

import { PROFILE_INTEREST_OPTIONS } from '@/mobile/app/catalog/profileInterests';
import { AuthImagePicker, AuthStepDots } from '@/mobile/app/features/auth/public/components';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { MultiSelectChipField } from '@/mobile/app/shared/components/ui/MultiSelectChipField';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
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

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <SettingsHeader
        title={tr.settings.editProfile.title}
        onBack={onBack}
        actionLabel={tr.common.cancel}
        onAction={onCancel}
        actionVariant="ghost"
      />

      <View style={styles.stepHeader}>
        <AuthStepDots current={editStep} total={steps.length} />
        <Text style={styles.stepCounter}>
          {tr.settings.editProfile.stepCounter(editStep + 1, steps.length)}
        </Text>
      </View>

      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{currentEditStep.title}</Text>
        <Text style={styles.stepDescription}>{currentEditStep.description}</Text>
      </View>

      {editStep === 0 ? (
        <View style={styles.form}>
          <TextField
            label={tr.settings.editProfile.nameLabel}
            value={editName}
            onChangeText={onChangeName}
            maxLength={USER_NAME_MAX_LENGTH}
          />
          <TextField
            label={tr.settings.editProfile.usernameLabel}
            value={editUsername}
            onChangeText={onChangeUsername}
            autoCapitalize="none"
            helper={usernameHelper}
            helperTone={usernameHelperTone}
            maxLength={USERNAME_MAX_LENGTH}
          />
          <TextField
            label={tr.settings.editProfile.bioLabel}
            value={editBio}
            onChangeText={onChangeBio}
            multilineRows={4}
            placeholder={tr.settings.editProfile.bioPlaceholder}
            maxLength={USER_BIO_MAX_LENGTH}
          />
        </View>
      ) : null}

      {editStep === 1 ? (
        <View style={styles.form}>
          <View style={styles.helperCard}>
            <Text style={styles.helperCardTitle}>{tr.settings.editProfile.interestsTitle}</Text>
            <Text style={styles.helperCardText}>
              {tr.settings.editProfile.interestsDescription}
            </Text>
          </View>

          <MultiSelectChipField
            options={PROFILE_INTEREST_OPTIONS}
            selectedValues={editInterests}
            onToggle={toggleInterest}
          />

          <Text style={styles.selectionMeta}>
            {tr.settings.editProfile.interestsSelection(editInterests.length)}
          </Text>
        </View>
      ) : null}

      {editStep === 2 ? (
        <View style={styles.form}>
          <View style={styles.photoSection}>
            <AuthImagePicker
              uri={profilePhoto}
              shape="circle"
              placeholderIcon={<Camera color={colors.textSoft} size={26} />}
              placeholderText={tr.settings.editProfile.profilePhoto}
              helperText={tr.settings.editProfile.profilePhotoHelper}
              onPress={selectProfilePhoto}
              onClear={clearProfilePhoto}
            />
          </View>

          <AuthImagePicker
            uri={coverPhoto}
            shape="cover"
            placeholderIcon={<Camera color={colors.textSoft} size={24} />}
            placeholderText={tr.settings.editProfile.coverPhoto}
            helperText={tr.settings.editProfile.coverPhotoHelper}
            onPress={selectCoverPhoto}
            onClear={clearCoverPhoto}
          />
        </View>
      ) : null}

      {isSavingProfile ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.primary} />
          <View style={styles.loadingCardBody}>
            <Text style={styles.loadingCardTitle}>{tr.settings.editProfile.saveInFlightTitle}</Text>
            <Text style={styles.loadingCardText}>
              {saveProfileMessage || tr.settings.editProfile.saveInFlight}
            </Text>
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
