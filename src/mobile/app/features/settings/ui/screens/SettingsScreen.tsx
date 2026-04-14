import React from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Ban,
  Lock,
  LockKeyhole,
  LogOut,
  Shield,
  Trash2,
  User as UserIcon,
} from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useSettingsAccountState } from '@/mobile/app/features/settings/application/useSettingsAccountState';
import { useSettingsScreenState } from '@/mobile/app/features/settings/application/useSettingsScreenState';
import { SettingsBlockedUsersView } from '@/mobile/app/features/settings/ui/components/SettingsBlockedUsersView';
import { SettingsEditProfileFlow } from '@/mobile/app/features/settings/ui/components/SettingsEditProfileFlow';
import { SettingsMainMenuView } from '@/mobile/app/features/settings/ui/components/SettingsMainMenuView';
import { SettingsPasswordView } from '@/mobile/app/features/settings/ui/components/SettingsPasswordView';
import { SettingsPrivacyView } from '@/mobile/app/features/settings/ui/components/SettingsPrivacyView';
import {
  type SettingsMenuItem,
} from '@/mobile/app/features/settings/ui/components/SettingsMenuSection';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';

const editProfileSteps = [
  {
    title: tr.settings.editProfile.steps.basics,
    description: tr.settings.editProfile.basicsDescription,
  },
  {
    title: 'Ilgi alanlari',
    description: 'Profilinde rozet olarak gozukmesini istedigin ilgi alanlarini sec.',
  },
  {
    title: tr.settings.editProfile.steps.photos,
    description: 'Profil ve kapak gorsellerini sec.',
  },
  {
    title: tr.settings.editProfile.steps.preview,
    description: tr.settings.editProfile.previewDescription,
  },
] as const;

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, refreshUser, requestPasswordReset } = useAuth();
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
    openBlocked,
    openEditProfile,
    openPassword,
    openPrivacy,
    profilePhoto,
    resetMailSent,
    saveAccountPrivacy,
    saveProfile,
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

  if (!freshUser) {
    return null;
  }

  const goBack = () => {
    if (view === 'main') {
      navigation.goBack();
      return;
    }

    if (view === 'editProfile' && editStep > 0) {
      goToPreviousEditStep();
      return;
    }

    goToMain();
  };

  const sections: Array<{ title: string; items: SettingsMenuItem[] }> = [
    {
      title: tr.settings.sections.account,
      items: [
        {
          icon: <UserIcon color={colors.onPrimary} size={18} />,
          label: tr.settings.editProfile.title,
          color: colors.primary,
          action: openEditProfile,
        },
        {
          icon: <Shield color={colors.onPrimary} size={18} />,
          label: tr.settings.privacy.title,
          color: colors.secondary,
          action: openPrivacy,
        },
        {
          icon: <Lock color={colors.onPrimary} size={18} />,
          label: tr.settings.password.title,
          color: colors.warning,
          action: openPassword,
        },
      ],
    },
    {
      title: tr.settings.sections.other,
      items: [
        {
          icon: <Ban color={colors.onPrimary} size={18} />,
          label: tr.settings.blocked.title,
          color: colors.textMuted,
          action: openBlocked,
        },
        {
          icon: <LogOut color={colors.onPrimary} size={18} />,
          label: tr.settings.logout,
          color: colors.warning,
          action: () => setShowLogoutConfirm(true),
        },
        {
          icon: <Trash2 color={colors.onPrimary} size={18} />,
          label: tr.settings.deleteAccount,
          color: colors.danger,
          action: () => setShowDeleteConfirm(true),
          danger: true,
        },
      ],
    },
  ];

  if (view === 'editProfile') {
    return (
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
        onBack={goBack}
        onChangeBio={setEditBio}
        onChangeName={setEditName}
        onChangeUsername={updateEditUsername}
        onNext={goToNextEditStep}
        onRefresh={onRefresh}
        onSave={() => {
          void saveProfile();
        }}
        profilePhoto={profilePhoto}
        refreshing={refreshing}
        selectCoverPhoto={selectCoverPhoto}
        selectProfilePhoto={selectProfilePhoto}
        steps={editProfileSteps}
        toggleInterest={toggleInterest}
        userBioFallback={freshUser.bio}
        userCoverPhoto={freshUser.coverPhoto}
        userNameFallback={freshUser.name}
        userProfilePhoto={freshUser.profilePhoto}
        userUsernameFallback={freshUser.username}
        usernameHelper={usernameHelper}
        usernameHelperTone={usernameHelperTone}
      />
    );
  }

  if (view === 'privacy') {
    return (
      <SettingsPrivacyView
        isPublicAccount={isPublicAccount}
        onBack={goBack}
        onRefresh={onRefresh}
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
        onBack={goBack}
        onChangeCurrentPassword={setCurrentPassword}
        onRefresh={onRefresh}
        onSendResetMail={() => {
          void sendPasswordResetMail();
        }}
        onTogglePasswordVisibility={() => setShowPassword((value) => !value)}
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
