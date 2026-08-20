import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

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
const PASSWORD_RESET_COOLDOWN_MS = 30_000;

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

// Narrow pure-function surface for exhaustive settings feedback tests.
export const settingsScreenInternals = {
  getErrorMessage,
  hasPendingLocalMedia,
};

type SettingsViewActionsParams = {
  canContinueEdit: boolean;
  freshUser: User | null;
  refreshCurrentUserState: () => Promise<User | null>;
  setCoverPhoto: Dispatch<SetStateAction<string | undefined>>;
  setEditBioState: Dispatch<SetStateAction<string>>;
  setEditInterests: Dispatch<SetStateAction<string[]>>;
  setEditNameState: Dispatch<SetStateAction<string>>;
  setEditStep: Dispatch<SetStateAction<number>>;
  setEditUsernameState: Dispatch<SetStateAction<string>>;
  setProfilePhoto: Dispatch<SetStateAction<string | undefined>>;
  setView: Dispatch<SetStateAction<SettingsView>>;
};

function useSettingsViewActions({
  canContinueEdit,
  freshUser,
  refreshCurrentUserState,
  setCoverPhoto,
  setEditBioState,
  setEditInterests,
  setEditNameState,
  setEditStep,
  setEditUsernameState,
  setProfilePhoto,
  setView,
}: SettingsViewActionsParams) {
  const openEditProfile = useCallback(() => {
    if (freshUser) {
      setEditNameState(normalizeUserNameInput(freshUser.name || ''));
      setEditUsernameState(normalizeUsernameInput(freshUser.username || ''));
      setEditBioState(normalizeUserBioInput(freshUser.bio || ''));
      setEditInterests(freshUser.interests || []);
      setProfilePhoto(freshUser.profilePhoto);
      setCoverPhoto(freshUser.coverPhoto);
    }
    setEditStep(0);
    setView('editProfile');
    void refreshCurrentUserState().catch((error) => {
      logger.debug('settings', 'Failed to refresh edit profile snapshot', error);
    });
  }, [
    freshUser,
    refreshCurrentUserState,
    setCoverPhoto,
    setEditBioState,
    setEditInterests,
    setEditNameState,
    setEditStep,
    setEditUsernameState,
    setProfilePhoto,
    setView,
  ]);

  const goToMain = useCallback(() => setView('main'), [setView]);
  const goToPreviousEditStep = useCallback(
    () => setEditStep((current) => Math.max(0, current - 1)),
    [setEditStep],
  );
  const goToNextEditStep = useCallback(() => {
    if (canContinueEdit) {
      setEditStep((current) => current + 1);
    }
  }, [canContinueEdit, setEditStep]);
  const openPrivacy = useCallback(() => setView('privacy'), [setView]);
  const openPassword = useCallback(() => setView('password'), [setView]);
  const openBlocked = useCallback(() => setView('blocked'), [setView]);

  const selectProfilePhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({ cropAspect: [1, 1], cropShape: 'oval' });
    if (uri) {
      setProfilePhoto(uri);
    }
  }, [setProfilePhoto]);

  const selectCoverPhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({
      cropAspect: [21, 9],
      cropShape: 'rectangle',
    });
    if (uri) {
      setCoverPhoto(uri);
    }
  }, [setCoverPhoto]);

  const clearProfilePhoto = useCallback(() => setProfilePhoto(undefined), [setProfilePhoto]);
  const clearCoverPhoto = useCallback(() => setCoverPhoto(undefined), [setCoverPhoto]);

  return {
    clearCoverPhoto,
    clearProfilePhoto,
    goToMain,
    goToNextEditStep,
    goToPreviousEditStep,
    openBlocked,
    openEditProfile,
    openPassword,
    openPrivacy,
    selectCoverPhoto,
    selectProfilePhoto,
  };
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
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isPasswordResetCoolingDown, setIsPasswordResetCoolingDown] = useState(false);
  const privacySavingRef = useRef(false);
  const privacyValueRef = useRef(freshUser?.isPublicAccount ?? true);
  const passwordResetPendingRef = useRef(false);
  const passwordResetCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (!privacySavingRef.current) {
      const nextPrivacyValue = freshUser.isPublicAccount ?? true;
      privacyValueRef.current = nextPrivacyValue;
      setIsPublicAccount(nextPrivacyValue);
    }
  }, [freshUser, view]);

  useEffect(
    () => () => {
      if (passwordResetCooldownTimeoutRef.current) {
        clearTimeout(passwordResetCooldownTimeoutRef.current);
      }
    },
    [],
  );

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

      if (privacySavingRef.current) {
        return;
      }

      if (nextIsPublicAccount === privacyValueRef.current) {
        setIsPublicAccount(nextIsPublicAccount);
        return;
      }

      const previousPrivacyValue = privacyValueRef.current;
      privacySavingRef.current = true;
      privacyValueRef.current = nextIsPublicAccount;
      setIsSavingPrivacy(true);
      setIsPublicAccount(nextIsPublicAccount);

      try {
        await persistAccountPrivacy(nextIsPublicAccount);
        showToast(
          nextIsPublicAccount ? tr.settings.privacy.publicSaved : tr.settings.privacy.privateSaved,
          'success',
        );
      } catch (error) {
        logger.error('settings', 'Failed to update account privacy', error);
        privacyValueRef.current = previousPrivacyValue;
        setIsPublicAccount(previousPrivacyValue);
        showToast(getErrorMessage(error, tr.settings.toast.privacyFailed), 'error');
      } finally {
        privacySavingRef.current = false;
        setIsSavingPrivacy(false);
      }
    },
    [freshUser, persistAccountPrivacy],
  );

  const sendPasswordResetMail = useCallback(async () => {
    if (passwordResetPendingRef.current || isPasswordResetCoolingDown) {
      return;
    }

    if (!currentPassword.trim()) {
      showToast(tr.settings.password.missingFields, 'error');
      return;
    }

    passwordResetPendingRef.current = true;
    setIsSendingPasswordReset(true);

    try {
      const result = await requestPasswordReset(currentPassword);

      if (!result.success) {
        showToast(tr.auth.toast.loginInvalid, 'error');
        return;
      }

      setResetMailSent(true);
      setCurrentPassword('');
      setIsPasswordResetCoolingDown(true);
      if (passwordResetCooldownTimeoutRef.current) {
        clearTimeout(passwordResetCooldownTimeoutRef.current);
      }
      passwordResetCooldownTimeoutRef.current = setTimeout(() => {
        passwordResetCooldownTimeoutRef.current = null;
        setIsPasswordResetCoolingDown(false);
      }, PASSWORD_RESET_COOLDOWN_MS);
      showToast(tr.settings.password.resetSent, 'success');
    } catch (error) {
      logger.error('settings', 'Failed to send password reset email', error);
      showToast(getErrorMessage(error, tr.settings.toast.passwordResetFailed), 'error');
    } finally {
      passwordResetPendingRef.current = false;
      setIsSendingPasswordReset(false);
    }
  }, [currentPassword, isPasswordResetCoolingDown, requestPasswordReset]);

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

  const {
    clearCoverPhoto,
    clearProfilePhoto,
    goToMain,
    goToNextEditStep,
    goToPreviousEditStep,
    openBlocked,
    openEditProfile,
    openPassword,
    openPrivacy,
    selectCoverPhoto,
    selectProfilePhoto,
  } = useSettingsViewActions({
    canContinueEdit,
    freshUser,
    refreshCurrentUserState,
    setCoverPhoto,
    setEditBioState,
    setEditInterests,
    setEditNameState,
    setEditStep,
    setEditUsernameState,
    setProfilePhoto,
    setView,
  });

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
    isPasswordResetCoolingDown,
    isSavingPrivacy,
    isSavingProfile,
    isSendingPasswordReset,
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
