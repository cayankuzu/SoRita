import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useSettingsAccountState } from '@/mobile/app/features/settings/application/useSettingsAccountState';
import { useSettingsDataControls } from '@/mobile/app/features/settings/application/useSettingsDataControls';
import { useSettingsScreenState } from '@/mobile/app/features/settings/application/useSettingsScreenState';
import { SettingsBlockedUsersView } from '@/mobile/app/features/settings/ui/components/SettingsBlockedUsersView';
import { SettingsEditProfileFlow } from '@/mobile/app/features/settings/ui/components/SettingsEditProfileFlow';
import { SettingsMainMenuView } from '@/mobile/app/features/settings/ui/components/SettingsMainMenuView';
import { SettingsPasswordView } from '@/mobile/app/features/settings/ui/components/SettingsPasswordView';
import { SettingsPrivacyView } from '@/mobile/app/features/settings/ui/components/SettingsPrivacyView';
import { buildSettingsMenuSections } from '@/mobile/app/features/settings/ui/components/buildSettingsMenuSections';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { useAndroidBackHandler } from '@/mobile/app/shared/hooks/useAndroidBackHandler';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, spacing, typography } from '@/mobile/app/shared/theme/tokens';
import {
  normalizeUserBioInput,
  normalizeUserNameInput,
  normalizeUsernameInput,
} from '@/mobile/app/shared/validation/contentLimits';

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const editProfileSteps = [
  {
    title: tr.settings.editProfile.steps.basics,
    description: tr.settings.editProfile.basicsDescription,
  },
  {
    title: tr.settings.editProfile.interestsTitle,
    description: tr.settings.editProfile.interestsDescription,
  },
  {
    title: tr.settings.editProfile.steps.photos,
    description: tr.settings.editProfile.photosDescription,
  },
] as const;

function SettingsLoadingState() {
  return (
    <Screen variant="settings">
      <View
        accessible
        accessibilityLabel={tr.common.loading}
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={loadingStyles.container}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={loadingStyles.label}>{tr.common.loading}</Text>
      </View>
    </Screen>
  );
}

export function SettingsScreen() {
  const navigation = useAppNavigation();
  const { user, logout, refreshUser, requestPasswordReset } = useAuth();
  const [showEditCancelConfirm, setShowEditCancelConfirm] = React.useState(false);
  const {
    analyticsConsentGranted,
    exportPersonalData,
    isExportingPersonalData,
    isSavingAnalyticsConsent,
    saveAnalyticsConsent,
  } = useSettingsDataControls();
  const {
    blockedUsers,
    deleteCurrentUser,
    freshUser,
    onRefresh,
    refreshing,
    refreshCurrentUserState,
    saveAccountPrivacy: persistAccountPrivacy,
    saveUserProfile,
  } = useSettingsAccountState({
    refreshUser,
    user,
  });
  const {
    canContinueEdit,
    clearCoverPhoto,
    clearProfilePhoto,
    coverPhoto,
    currentPassword,
    deleteAccount,
    editBio,
    editInterests,
    editName,
    editStep,
    editUsername,
    goToMain,
    goToNextEditStep,
    goToPreviousEditStep,
    handleLogout,
    isPublicAccount,
    isPasswordResetCoolingDown,
    isSavingPrivacy,
    isSavingProfile,
    isSendingPasswordReset,
    openBlocked,
    openEditProfile,
    openPassword,
    openPrivacy,
    passwordResetError,
    profilePhoto,
    resetMailSent,
    saveAccountPrivacy,
    saveProfile,
    saveProfileMessage,
    selectCoverPhoto,
    selectProfilePhoto,
    sendPasswordResetMail,
    setCurrentPassword,
    setEditBio,
    setEditName,
    setShowDeleteConfirm,
    setShowLogoutConfirm,
    setShowPassword,
    showDeleteConfirm,
    showLogoutConfirm,
    showPassword,
    toggleInterest,
    updateEditUsername,
    usernameHelper,
    usernameHelperTone,
    view,
  } = useSettingsScreenState({
    deleteCurrentUser,
    freshUser,
    logout,
    persistAccountPrivacy,
    refreshCurrentUserState,
    requestPasswordReset,
    saveUserProfile,
  });
  const hasUnsavedEditProfileChanges = React.useMemo(() => {
    if (!freshUser) {
      return false;
    }

    return (
      normalizeUserNameInput(editName).trim() !== normalizeUserNameInput(freshUser.name || '').trim() ||
      normalizeUsernameInput(editUsername).trim() !== normalizeUsernameInput(freshUser.username || '').trim() ||
      normalizeUserBioInput(editBio).trim() !== normalizeUserBioInput(freshUser.bio || '').trim() ||
      !areStringArraysEqual(editInterests, freshUser.interests || []) ||
      (profilePhoto || '') !== (freshUser.profilePhoto || '') ||
      (coverPhoto || '') !== (freshUser.coverPhoto || '')
    );
  }, [
    coverPhoto,
    editBio,
    editInterests,
    editName,
    editUsername,
    freshUser,
    profilePhoto,
  ]);

  const requestExitEditProfile = () => {
    if (isSavingProfile) {
      return;
    }

    if (hasUnsavedEditProfileChanges) {
      setShowEditCancelConfirm(true);
      return;
    }

    goToMain();
  };

  const goBack = () => {
    if (view === 'main') {
      navigation.goBack();
      return;
    }

    if (view === 'editProfile' && editStep > 0) {
      goToPreviousEditStep();
      return;
    }

    if (view === 'editProfile') {
      requestExitEditProfile();
      return;
    }

    goToMain();
  };

  const cancelEditProfile = () => {
    requestExitEditProfile();
  };

  useAndroidBackHandler(view !== 'main', () => {
    goBack();
    return true;
  });

  if (!freshUser) {
    return <SettingsLoadingState />;
  }

  const sections = buildSettingsMenuSections({
    exportPersonalData,
    isExportingPersonalData,
    openBlocked,
    openDeveloperCatalog: () => openStackScreen(navigation, 'UICatalog'),
    openEditProfile,
    openPassword,
    openPrivacy,
    requestDeleteAccount: () => setShowDeleteConfirm(true),
    requestLogout: () => setShowLogoutConfirm(true),
  });

  if (view === 'editProfile') {
    return (
      <>
        <SettingsEditProfileFlow
          canContinueEdit={canContinueEdit}
          clearCoverPhoto={clearCoverPhoto}
          clearProfilePhoto={clearProfilePhoto}
          coverPhoto={coverPhoto}
          editBio={editBio}
          editInterests={editInterests}
          editName={editName}
          editStep={editStep}
          editUsername={editUsername}
          isSavingProfile={isSavingProfile}
          onBack={goBack}
          onCancel={cancelEditProfile}
          onChangeBio={setEditBio}
          onChangeName={setEditName}
          onChangeUsername={updateEditUsername}
          onNext={goToNextEditStep}
          onRefresh={onRefresh}
          onSave={async () => {
            const saved = await saveProfile();

            if (saved) {
              navigation.navigate('MainTabs', { screen: 'Profile' });
            }
          }}
          profilePhoto={profilePhoto}
          refreshing={refreshing}
          saveProfileMessage={saveProfileMessage}
          selectCoverPhoto={selectCoverPhoto}
          selectProfilePhoto={selectProfilePhoto}
          steps={editProfileSteps}
          toggleInterest={toggleInterest}
          usernameHelper={usernameHelper}
          usernameHelperTone={usernameHelperTone}
        />

        <ConfirmActionModal
          visible={showEditCancelConfirm}
          title={tr.settings.editProfile.discardTitle}
          description={tr.settings.editProfile.discardDescription}
          confirmLabel={tr.common.cancel}
          confirmVariant="danger"
          onClose={() => setShowEditCancelConfirm(false)}
          onConfirm={() => {
            setShowEditCancelConfirm(false);
            goToMain();
          }}
        />
      </>
    );
  }

  if (view === 'privacy') {
    return (
      <SettingsPrivacyView
        analyticsConsentGranted={analyticsConsentGranted}
        isPublicAccount={isPublicAccount}
        isSavingAnalyticsConsent={isSavingAnalyticsConsent}
        isSavingPrivacy={isSavingPrivacy}
        onBack={goBack}
        onRefresh={onRefresh}
        onSaveAnalyticsConsent={saveAnalyticsConsent}
        onSavePrivacy={(value) => {
          void saveAccountPrivacy(value);
        }}
        refreshing={refreshing}
      />
    );
  }

  if (view === 'password') {
    return (
      <SettingsPasswordView
        currentPassword={currentPassword}
        email={freshUser.email}
        isPasswordResetCoolingDown={isPasswordResetCoolingDown}
        isSendingPasswordReset={isSendingPasswordReset}
        onBack={goBack}
        onChangeCurrentPassword={setCurrentPassword}
        onRefresh={onRefresh}
        onSendResetMail={() => {
          void sendPasswordResetMail();
        }}
        onTogglePasswordVisibility={() => setShowPassword((value) => !value)}
        passwordResetError={passwordResetError}
        refreshing={refreshing}
        resetMailSent={resetMailSent}
        showPassword={showPassword}
      />
    );
  }

  if (view === 'blocked') {
    return (
      <SettingsBlockedUsersView
        blockedUsers={blockedUsers}
        onBack={goBack}
        onOpenBlockedUser={(userId) =>
          openStackScreen(navigation, 'UserProfile', { userId, allowBlockedView: true })
        }
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    );
  }

  return (
    <>
      <SettingsMainMenuView
        onBack={goBack}
        onRefresh={onRefresh}
        refreshing={refreshing}
        sections={sections}
      />

      <ConfirmActionModal
        visible={showLogoutConfirm}
        title={tr.settings.logoutTitle}
        description={tr.settings.logoutConfirm}
        confirmLabel={tr.settings.logout}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
      />

      <ConfirmActionModal
        visible={showDeleteConfirm}
        title={tr.settings.deleteAccount}
        description={tr.settings.deleteConfirm}
        confirmLabel={tr.settings.deleteAccount}
        confirmVariant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={deleteAccount}
      />

    </>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 240,
  },
  label: {
    ...typography.bodyText,
    color: colors.textMuted,
  },
});
