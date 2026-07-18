import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import type { User } from '@/mobile/app/data/contracts/entities';
import { useUsernameAvailabilityQuery } from '@/mobile/app/data/hooks/useAccountAvailabilityQuery';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { pickSingleImageFromPrompt } from '@/mobile/app/platform/media/images';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  normalizeUserBioInput,
  normalizeUserNameInput,
  normalizeUsernameInput,
} from '@/mobile/app/shared/validation/contentLimits';

export type SettingsView = 'main' | 'editProfile' | 'privacy' | 'password' | 'blocked';

type HelperTone = 'muted' | 'danger' | 'success';

type UseSettingsScreenStateParams = {
  deleteCurrentUser: () => Promise<void>;
  freshUser: User | null;
  logout: AuthContextType['logout'];
  persistAccountPrivacy: (nextIsPublicAccount: boolean) => Promise<unknown>;
  refreshCurrentUserState: () => Promise<User | null>;
  requestPasswordReset: AuthContextType['requestPasswordReset'];
  saveUserProfile: (nextUser: User) => Promise<User>;
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallbackMessage;
}

function hasPendingLocalMedia(uri?: string) {
  return Boolean(uri && !/^https?:\/\//i.test(uri));
}

export function useSettingsScreenState({
  deleteCurrentUser,
  freshUser,
  logout,
  persistAccountPrivacy,
  refreshCurrentUserState,
  requestPasswordReset,
  saveUserProfile,
}: UseSettingsScreenStateParams) {
  const [view, setView] = useState<SettingsView>('main');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editName, setEditNameState] = useState(normalizeUserNameInput(freshUser?.name || ''));
  const [editUsername, setEditUsernameState] = useState(normalizeUsernameInput(freshUser?.username || ''));
  const [editBio, setEditBioState] = useState(normalizeUserBioInput(freshUser?.bio || ''));
  const [editInterests, setEditInterests] = useState<string[]>(freshUser?.interests || []);
  const [profilePhoto, setProfilePhoto] = useState(freshUser?.profilePhoto);
  const [coverPhoto, setCoverPhoto] = useState(freshUser?.coverPhoto);
  const [isPublicAccount, setIsPublicAccount] = useState(freshUser?.isPublicAccount ?? true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetMailSent, setResetMailSent] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const normalizedEditName = normalizeUserNameInput(editName).trim();
  const normalizedEditUsername = normalizeUsernameInput(editUsername).trim();
  const normalizedEditBio = normalizeUserBioInput(editBio).trim();
  const currentUsername = freshUser?.username.trim().toLowerCase() || '';
  const { availability: usernameAvailability } = useUsernameAvailabilityQuery({
    active: Boolean(freshUser && view === 'editProfile'),
    availableMessage:
      normalizedEditUsername === currentUsername
        ? tr.settings.editProfile.helperSameUsername
        : tr.settings.editProfile.helperUsernameUsable,
    checkingMessage: tr.settings.editProfile.helperUsernameChecking,
    errorMessage: tr.settings.editProfile.helperUsernameError,
    excludeUserId: freshUser?.id,
    invalidMessage: (value) =>
      value.length < 3 ? tr.settings.editProfile.helperUsernameTooShort : null,
    unavailableMessage: tr.settings.editProfile.helperUsernameTaken,
    value: editUsername,
  });

  useEffect(() => {
    if (!freshUser || view === 'editProfile') {
      return;
    }

    setEditNameState(normalizeUserNameInput(freshUser.name || ''));
    setEditUsernameState(normalizeUsernameInput(freshUser.username || ''));
    setEditBioState(normalizeUserBioInput(freshUser.bio || ''));
    setEditInterests(freshUser.interests || []);
    setProfilePhoto(freshUser.profilePhoto);
    setCoverPhoto(freshUser.coverPhoto);
    setIsPublicAccount(freshUser.isPublicAccount ?? true);
  }, [freshUser, view]);

  const resetSettingsState = useCallback(async () => {
    const nextUser = await refreshCurrentUserState();

    if (!nextUser) {
      return;
    }

    setEditNameState(normalizeUserNameInput(nextUser.name));
    setEditUsernameState(normalizeUsernameInput(nextUser.username));
    setEditBioState(normalizeUserBioInput(nextUser.bio || ''));
    setEditInterests(nextUser.interests || []);
    setProfilePhoto(nextUser.profilePhoto);
    setCoverPhoto(nextUser.coverPhoto);
    setIsPublicAccount(nextUser.isPublicAccount ?? true);
    setCurrentPassword('');
    setResetMailSent(false);
  }, [refreshCurrentUserState]);

  const saveProfile = useCallback(async () => {
    if (!freshUser) {
      return false;
    }

    if (isSavingProfile) {
      return false;
    }

    if (!normalizedEditName || !normalizedEditUsername) {
      showToast(tr.settings.editProfile.required, 'error');
      return false;
    }

    if (usernameAvailability.status !== 'available') {
      showToast(tr.settings.toast.usernameSelectUnique, 'error');
      return false;
    }

    const updatedUser = {
      ...freshUser,
      name: normalizedEditName,
      username: normalizedEditUsername,
      bio: normalizedEditBio || undefined,
      interests: editInterests.length > 0 ? editInterests : undefined,
      profilePhoto,
      coverPhoto,
      isPublicAccount: freshUser.isPublicAccount ?? true,
    };

    setIsSavingProfile(true);

    try {
      await saveUserProfile(updatedUser);
      showToast(tr.settings.editProfile.saved, 'success');
      setView('main');
      setEditStep(0);
      return true;
    } catch (error) {
      logger.error('settings', 'Failed to save profile', error);
      showToast(getErrorMessage(error, tr.settings.toast.profileSaveFailed), 'error');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }, [
    coverPhoto,
    editInterests,
    freshUser,
    isSavingProfile,
    normalizedEditBio,
    normalizedEditName,
    normalizedEditUsername,
    profilePhoto,
    saveUserProfile,
    usernameAvailability.status,
  ]);

  const saveAccountPrivacy = useCallback(
    async (nextIsPublicAccount: boolean) => {
      if (!freshUser) {
        return;
      }

      if (nextIsPublicAccount === (freshUser.isPublicAccount ?? true)) {
        setIsPublicAccount(nextIsPublicAccount);
        return;
      }

      setIsPublicAccount(nextIsPublicAccount);

      try {
        await persistAccountPrivacy(nextIsPublicAccount);
        showToast(
          nextIsPublicAccount ? tr.settings.privacy.publicSaved : tr.settings.privacy.privateSaved,
          'success',
        );
      } catch (error) {
        logger.error('settings', 'Failed to update account privacy', error);
        setIsPublicAccount(freshUser.isPublicAccount ?? true);
        showToast(getErrorMessage(error, tr.settings.toast.privacyFailed), 'error');
      }
    },
    [freshUser, persistAccountPrivacy],
  );

  const sendPasswordResetMail = useCallback(async () => {
    if (!currentPassword.trim()) {
      showToast(tr.settings.password.missingFields, 'error');
      return;
    }

    try {
      const result = await requestPasswordReset(currentPassword);

      if (!result.success) {
        showToast(tr.auth.toast.loginInvalid, 'error');
        return;
      }

      setResetMailSent(true);
      setCurrentPassword('');
      showToast(tr.settings.password.resetSent, 'success');
    } catch (error) {
      logger.error('settings', 'Failed to send password reset email', error);
      showToast(getErrorMessage(error, tr.settings.toast.passwordResetFailed), 'error');
    }
  }, [currentPassword, requestPasswordReset]);

  const deleteAccount = useCallback(async () => {
    try {
      await deleteCurrentUser();
      showToast(tr.settings.accountDeleted, 'success');
      await logout();
    } catch (error) {
      logger.error('settings', 'Failed to delete account', error);
      throw error;
    }
  }, [deleteCurrentUser, logout]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('settings', 'Failed to logout', error);
      throw error;
    }
  }, [logout]);

  const toggleInterest = useCallback((value: string) => {
    setEditInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }, []);

  const usernameHelper = useMemo(
    () =>
      usernameAvailability.status === 'idle'
        ? tr.settings.editProfile.helperUsernameIdle
        : usernameAvailability.message,
    [usernameAvailability],
  );

  const usernameHelperTone = useMemo<HelperTone>(() => {
    if (usernameAvailability.status === 'available') {
      return 'success';
    }

    if (
      usernameAvailability.status === 'invalid' ||
      usernameAvailability.status === 'unavailable' ||
      usernameAvailability.status === 'error'
    ) {
      return 'danger';
    }

    return 'muted';
  }, [usernameAvailability.status]);

  const canContinueEdit = useMemo(
    () =>
      editStep === 0
        ? normalizedEditName.length >= 2 && usernameAvailability.status === 'available'
        : true,
    [editStep, normalizedEditName, usernameAvailability.status],
  );

  const saveProfileMessage = useMemo(() => {
    if (!isSavingProfile) {
      return '';
    }

    if (hasPendingLocalMedia(profilePhoto) || hasPendingLocalMedia(coverPhoto)) {
      return tr.settings.editProfile.saveWithUploads;
    }

    return tr.settings.editProfile.saveInFlight;
  }, [coverPhoto, isSavingProfile, profilePhoto]);

  const openEditProfile = useCallback(() => {
    void resetSettingsState();
    setEditStep(0);
    setView('editProfile');
  }, [resetSettingsState]);

  const goToMain = useCallback(() => {
    setView('main');
  }, []);

  const goToPreviousEditStep = useCallback(() => {
    setEditStep((current) => Math.max(0, current - 1));
  }, []);

  const goToNextEditStep = useCallback(() => {
    if (!canContinueEdit) {
      return;
    }

    setEditStep((current) => current + 1);
  }, [canContinueEdit]);

  const openPrivacy = useCallback(() => {
    setView('privacy');
  }, []);

  const openPassword = useCallback(() => {
    setView('password');
  }, []);

  const openBlocked = useCallback(() => {
    setView('blocked');
  }, []);

  const selectProfilePhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({
      cropAspect: [1, 1],
      cropShape: 'oval',
    });

    if (uri) {
      setProfilePhoto(uri);
    }
  }, []);

  const selectCoverPhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({
      cropAspect: [21, 9],
      cropShape: 'rectangle',
    });

    if (uri) {
      setCoverPhoto(uri);
    }
  }, []);

  const clearProfilePhoto = useCallback(() => {
    setProfilePhoto(undefined);
  }, []);

  const clearCoverPhoto = useCallback(() => {
    setCoverPhoto(undefined);
  }, []);

  const setEditName = useCallback((value: string) => {
    setEditNameState(normalizeUserNameInput(value));
  }, []);

  const setEditBio = useCallback((value: string) => {
    setEditBioState(normalizeUserBioInput(value));
  }, []);

  const updateEditUsername = useCallback((value: string) => {
    setEditUsernameState(normalizeUsernameInput(value));
  }, []);

  return {
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
    isSavingProfile,
    openBlocked,
    openEditProfile,
    openPassword,
    openPrivacy,
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
  };
}
