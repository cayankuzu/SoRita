import { startTransition, useCallback, useMemo, useState } from 'react';

import type { AuthContextType } from '@/mobile/app/app-shell/auth/authTypes';
import type { User } from '@/mobile/app/data/contracts/entities';
import { useUsernameAvailabilityQuery } from '@/mobile/app/data/hooks/useAccountAvailabilityQuery';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { pickSingleImage } from '@/mobile/app/platform/media/images';
import { tr } from '@/mobile/app/shared/i18n/tr';

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
  const [editName, setEditName] = useState(freshUser?.name || '');
  const [editUsername, setEditUsername] = useState(freshUser?.username || '');
  const [editBio, setEditBio] = useState(freshUser?.bio || '');
  const [editInterests, setEditInterests] = useState<string[]>(freshUser?.interests || []);
  const [profilePhoto, setProfilePhoto] = useState(freshUser?.profilePhoto);
  const [coverPhoto, setCoverPhoto] = useState(freshUser?.coverPhoto);
  const [isPublicAccount, setIsPublicAccount] = useState(freshUser?.isPublicAccount ?? true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetMailSent, setResetMailSent] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const normalizedEditUsername = editUsername.trim().toLowerCase();
  const currentUsername = freshUser?.username.trim().toLowerCase() || '';
  const { availability: usernameAvailability } = useUsernameAvailabilityQuery({
    active: Boolean(freshUser && view === 'editProfile'),
    availableMessage:
      normalizedEditUsername === currentUsername
        ? 'Mevcut kullanici adin korunacak'
        : 'Bu kullanici adi kullanilabilir',
    checkingMessage: 'Kullanici adi kontrol ediliyor...',
    errorMessage: 'Kullanici adi su an kontrol edilemiyor',
    excludeUserId: freshUser?.id,
    invalidMessage: (value) =>
      value.length < 3 ? 'Kullanici adi en az 3 karakter olmali' : null,
    unavailableMessage: 'Bu kullanici adi zaten kullaniliyor',
    value: editUsername,
  });

  const resetSettingsState = useCallback(async () => {
    const nextUser = await refreshCurrentUserState();

    if (!nextUser) {
      return;
    }

    setEditName(nextUser.name);
    setEditUsername(nextUser.username);
    setEditBio(nextUser.bio || '');
    setEditInterests(nextUser.interests || []);
    setProfilePhoto(nextUser.profilePhoto);
    setCoverPhoto(nextUser.coverPhoto);
    setIsPublicAccount(nextUser.isPublicAccount ?? true);
    setCurrentPassword('');
    setResetMailSent(false);
  }, [refreshCurrentUserState]);

  const saveProfile = useCallback(async () => {
    if (!freshUser) {
      return;
    }

    if (isSavingProfile) {
      return;
    }

    if (!editName.trim() || !editUsername.trim()) {
      showToast(tr.settings.editProfile.required, 'error');
      return;
    }

    if (usernameAvailability.status !== 'available') {
      showToast('Once benzersiz bir kullanici adi sec', 'error');
      return;
    }

    const updatedUser = {
      ...freshUser,
      name: editName.trim(),
      username: editUsername.trim().toLowerCase(),
      bio: editBio.trim() || undefined,
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
    } catch (error) {
      logger.error('settings', 'Failed to save profile', error);
      showToast(getErrorMessage(error, 'Profil guncellenemedi'), 'error');
    } finally {
      setIsSavingProfile(false);
    }
  }, [
    coverPhoto,
    editBio,
    editInterests,
    editName,
    editUsername,
    freshUser,
    isSavingProfile,
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
        showToast(getErrorMessage(error, 'Hesap gizliligi guncellenemedi'), 'error');
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
      showToast(getErrorMessage(error, 'Sifre sifirlama maili gonderilemedi'), 'error');
    }
  }, [currentPassword, requestPasswordReset]);

  const deleteAccount = useCallback(async () => {
    setShowDeleteConfirm(false);

    try {
      await deleteCurrentUser();
      showToast(tr.settings.accountDeleted, 'success');
      await logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hesap silinemedi';
      showToast(message, 'error');
    }
  }, [deleteCurrentUser, logout]);

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(false);

    try {
      await logout();
    } catch (error) {
      logger.error('settings', 'Failed to logout', error);
      showToast(getErrorMessage(error, 'Cikis yapilamadi'), 'error');
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
        ? '@ ile gorunen kullanici adin'
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
        ? editName.trim().length >= 2 && usernameAvailability.status === 'available'
        : true,
    [editName, editStep, usernameAvailability.status],
  );

  const saveProfileMessage = useMemo(() => {
    if (!isSavingProfile) {
      return '';
    }

    if (hasPendingLocalMedia(profilePhoto) || hasPendingLocalMedia(coverPhoto)) {
      return 'Fotograflarin yukleniyor. Bu islem genelde kisa surer.';
    }

    return 'Profil bilgilerin kaydediliyor. Lutfen kisa bir sure bekle.';
  }, [coverPhoto, isSavingProfile, profilePhoto]);

  const openEditProfile = useCallback(() => {
    void resetSettingsState();
    startTransition(() => {
      setEditStep(0);
      setView('editProfile');
    });
  }, [resetSettingsState]);

  const goToMain = useCallback(() => {
    startTransition(() => {
      setView('main');
    });
  }, []);

  const goToPreviousEditStep = useCallback(() => {
    startTransition(() => {
      setEditStep((current) => Math.max(0, current - 1));
    });
  }, []);

  const goToNextEditStep = useCallback(() => {
    if (!canContinueEdit) {
      return;
    }

    startTransition(() => {
      setEditStep((current) => current + 1);
    });
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
    const uri = await pickSingleImage();

    if (uri) {
      setProfilePhoto(uri);
    }
  }, []);

  const selectCoverPhoto = useCallback(async () => {
    const uri = await pickSingleImage();

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

  const updateEditUsername = useCallback((value: string) => {
    setEditUsername(value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
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
