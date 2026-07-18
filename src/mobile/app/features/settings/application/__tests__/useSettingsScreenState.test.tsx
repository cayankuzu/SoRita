import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';
import type { User } from '@/mobile/app/data/contracts/entities';
import {
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

const useUsernameAvailabilityQueryMock = vi.fn();
const showToastMock = vi.fn();
const pickSingleImageMock = vi.fn();
const settingsScreenStateSourcePath = fileURLToPath(new URL('../useSettingsScreenState.ts', import.meta.url).href);

vi.mock('@/mobile/app/data/hooks/useAccountAvailabilityQuery', () => ({
  useUsernameAvailabilityQuery: useUsernameAvailabilityQueryMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

vi.mock('@/mobile/app/platform/media/images', () => ({
  pickSingleImageFromPrompt: pickSingleImageMock,
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, reject, resolve };
}

function createFreshUser(overrides: Partial<User> = {}): User {
  return {
    id: 'viewer',
    email: 'viewer@example.com',
    name: 'Viewer',
    username: 'viewer',
    isPublicAccount: true,
    ...overrides,
  };
}

describe('useSettingsScreenState', () => {
  beforeEach(() => {
    useUsernameAvailabilityQueryMock.mockReset();
    showToastMock.mockReset();
    pickSingleImageMock.mockReset();
    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'available' },
    });
  });

  it('drives the edit profile flow and saves the updated user', async () => {
    const freshUser = createFreshUser({
      bio: 'old bio',
      interests: ['coffee'],
    });
    const saveUserProfileMock = vi.fn().mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser,
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: saveUserProfileMock,
      }),
    );

    act(() => {
      hook.result.current.openEditProfile();
    });

    expect(hook.result.current.view).toBe('editProfile');

    act(() => {
      hook.result.current.setEditName('Ada Lovelace');
      hook.result.current.updateEditUsername('Ada!');
      hook.result.current.setEditBio(' Loves coffee ');
      hook.result.current.toggleInterest('music');
      hook.result.current.goToNextEditStep();
      hook.result.current.goToPreviousEditStep();
    });

    await act(async () => {
      await hook.result.current.saveProfile();
    });

    expect(saveUserProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bio: 'Loves coffee',
        interests: ['coffee', 'music'],
        name: 'Ada Lovelace',
        username: 'ada',
      }),
    );
    expect(hook.result.current.view).toBe('main');
    expect(hook.result.current.editStep).toBe(0);
    hook.unmount();
  });

  it('clamps profile inputs before saving', async () => {
    const freshUser = createFreshUser({
      bio: 'old bio',
      interests: ['coffee'],
    });
    const saveUserProfileMock = vi.fn().mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser,
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: saveUserProfileMock,
      }),
    );

    act(() => {
      hook.result.current.openEditProfile();
    });

    act(() => {
      hook.result.current.setEditName('N'.repeat(USER_NAME_MAX_LENGTH + 8));
      hook.result.current.updateEditUsername(`Ada__${'Z'.repeat(USERNAME_MAX_LENGTH + 10)}!!!`);
      hook.result.current.setEditBio('B'.repeat(USER_BIO_MAX_LENGTH + 20));
    });

    const clampedUsername = hook.result.current.editUsername;
    expect(hook.result.current.editName).toHaveLength(USER_NAME_MAX_LENGTH);
    expect(clampedUsername).toHaveLength(USERNAME_MAX_LENGTH);
    expect(clampedUsername).toMatch(/^[a-z0-9_]+$/);
    expect(hook.result.current.editBio).toHaveLength(USER_BIO_MAX_LENGTH);

    await act(async () => {
      await hook.result.current.saveProfile();
    });

    expect(saveUserProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'N'.repeat(USER_NAME_MAX_LENGTH),
        username: clampedUsername,
        bio: 'B'.repeat(USER_BIO_MAX_LENGTH),
      }),
    );
  });

  it('hydrates current profile and cover photos when fresh user data arrives later', async () => {
    let freshUser: {
      id: string;
      email: string;
      name: string;
      username: string;
      profilePhoto?: string;
      coverPhoto?: string;
      isPublicAccount: boolean;
    } | null = null;
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser,
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(hook.result.current.profilePhoto).toBeUndefined();
    expect(hook.result.current.coverPhoto).toBeUndefined();

    freshUser = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      profilePhoto: 'https://cdn.example/profile.jpg',
      coverPhoto: 'https://cdn.example/cover.jpg',
      isPublicAccount: true,
    };

    hook.rerender();

    expect(hook.result.current.profilePhoto).toBe('https://cdn.example/profile.jpg');
    expect(hook.result.current.coverPhoto).toBe('https://cdn.example/cover.jpg');
    hook.unmount();
  });

  it('exposes a saving state and message while the profile request is in flight', async () => {
    const freshUser = createFreshUser({
      bio: 'old bio',
      interests: ['coffee'],
    });
    const deferredSave = createDeferred<void>();
    const saveUserProfileMock = vi.fn().mockReturnValue(deferredSave.promise);
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser,
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: saveUserProfileMock,
      }),
    );

    act(() => {
      hook.result.current.openEditProfile();
      hook.result.current.setEditName('Ada Lovelace');
      hook.result.current.updateEditUsername('Ada!');
      hook.result.current.setEditBio('Loves coffee');
      hook.result.current.toggleInterest('music');
    });

    pickSingleImageMock.mockResolvedValueOnce('file://profile.jpg');

    await act(async () => {
      await hook.result.current.selectProfilePhoto();
    });

    let savePromise: Promise<boolean> | undefined;

    await act(async () => {
      savePromise = hook.result.current.saveProfile();
      await Promise.resolve();
    });

    expect(hook.result.current.isSavingProfile).toBe(true);
    expect(hook.result.current.saveProfileMessage).toContain('Fotoğrafların yükleniyor');

    deferredSave.resolve(undefined);

    await act(async () => {
      await savePromise;
    });

    expect(hook.result.current.isSavingProfile).toBe(false);
    expect(hook.result.current.saveProfileMessage).toBe('');
  });

  it('covers helper tones, navigation views, and photo clearing', async () => {
    const freshUser = createFreshUser();
    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'idle', message: 'idle' },
    });
    pickSingleImageMock.mockResolvedValueOnce(null).mockResolvedValueOnce('file://cover.jpg');
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser,
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(hook.result.current.usernameHelper).toContain('@');
    expect(hook.result.current.usernameHelperTone).toBe('muted');

    act(() => {
      hook.result.current.openPrivacy();
    });
    expect(hook.result.current.view).toBe('privacy');

    act(() => {
      hook.result.current.openPassword();
    });
    expect(hook.result.current.view).toBe('password');

    act(() => {
      hook.result.current.openBlocked();
    });
    expect(hook.result.current.view).toBe('blocked');

    act(() => {
      hook.result.current.goToMain();
      hook.result.current.setShowDeleteConfirm(true);
      hook.result.current.setShowLogoutConfirm(true);
      hook.result.current.setShowPassword(true);
    });
    expect(hook.result.current.view).toBe('main');
    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.showLogoutConfirm).toBe(true);
    expect(hook.result.current.showPassword).toBe(true);

    await act(async () => {
      await hook.result.current.selectProfilePhoto();
      await hook.result.current.selectCoverPhoto();
    });
    expect(hook.result.current.profilePhoto).toBeUndefined();
    expect(hook.result.current.coverPhoto).toBe('file://cover.jpg');

    act(() => {
      hook.result.current.clearProfilePhoto();
      hook.result.current.clearCoverPhoto();
    });
    expect(hook.result.current.coverPhoto).toBeUndefined();
  });

  it('blocks invalid saveProfile paths and surfaces failures', async () => {
    const freshUser = createFreshUser();
    const saveUserProfileMock = vi.fn().mockRejectedValue(new Error('save failed'));
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser,
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: saveUserProfileMock,
      }),
    );

    act(() => {
      hook.result.current.openEditProfile();
      hook.result.current.setEditName('');
      hook.result.current.setEditBio('  ');
    });
    await act(async () => {
      await hook.result.current.saveProfile();
    });

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'unavailable', message: 'taken' },
    });
    hook.rerender();
    act(() => {
      hook.result.current.setEditName('Ada');
    });
    await act(async () => {
      await hook.result.current.saveProfile();
    });

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'error', message: 'error' },
    });
    hook.rerender();
    expect(hook.result.current.usernameHelperTone).toBe('danger');

    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'available', message: 'available' },
    });
    hook.rerender();
    act(() => {
      hook.result.current.setEditName('Ada');
      hook.result.current.setEditBio('bio');
      hook.result.current.updateEditUsername('Ada!');
    });
    await act(async () => {
      await hook.result.current.saveProfile();
    });

    expect(showToastMock).toHaveBeenCalled();
  });

  it('handles privacy updates, password reset, delete, and logout flows', async () => {
    const freshUser = createFreshUser();
    const persistAccountPrivacyMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('privacy failed'));
    const logoutMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('logout failed'))
      .mockResolvedValueOnce(undefined);
    const deleteCurrentUserMock = vi.fn().mockResolvedValue(undefined);
    const requestPasswordResetMock = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce(new Error('reset failed'));
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: deleteCurrentUserMock,
        freshUser,
        logout: logoutMock,
        persistAccountPrivacy: persistAccountPrivacyMock,
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: requestPasswordResetMock,
        saveUserProfile: vi.fn().mockResolvedValue(undefined),
      }),
    );

    await act(async () => {
      await hook.result.current.saveAccountPrivacy(true);
      await hook.result.current.saveAccountPrivacy(false);
      await hook.result.current.saveAccountPrivacy(false);
    });

    await act(async () => {
      await hook.result.current.sendPasswordResetMail();
    });
    act(() => {
      hook.result.current.setCurrentPassword('current-password');
    });
    await act(async () => {
      await hook.result.current.sendPasswordResetMail();
      await hook.result.current.sendPasswordResetMail();
    });
    act(() => {
      hook.result.current.setCurrentPassword('current-password');
    });
    await act(async () => {
      await hook.result.current.sendPasswordResetMail();
    });

    act(() => {
      hook.result.current.setShowDeleteConfirm(true);
      hook.result.current.setShowLogoutConfirm(true);
    });

    await act(async () => {
      await hook.result.current.deleteAccount();
    });

    let logoutError: unknown;

    await act(async () => {
      try {
        await hook.result.current.handleLogout();
      } catch (error) {
        logoutError = error;
      }
    });

    await act(async () => {
      await hook.result.current.handleLogout();
    });

    expect(deleteCurrentUserMock).toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalled();
    expect(requestPasswordResetMock).toHaveBeenCalledWith('current-password');
    expect(hook.result.current.resetMailSent).toBe(true);
    expect(logoutError).toBeInstanceOf(Error);
    expect((logoutError as Error).message).toBe('logout failed');
    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.showLogoutConfirm).toBe(true);
    expect(showToastMock).toHaveBeenCalled();
  });

  it('keeps destructive action ownership in the confirmation modal contract', () => {
    const source = readFileSync(settingsScreenStateSourcePath, 'utf8');
    const deleteAccountBlock = source.match(/const deleteAccount = useCallback\(async \(\) => \{[\s\S]*?\n\s{2}\}, \[deleteCurrentUser, logout\]\);/)?.[0] ?? '';
    const logoutBlock = source.match(/const handleLogout = useCallback\(async \(\) => \{[\s\S]*?\n\s{2}\}, \[logout\]\);/)?.[0] ?? '';

    expect(deleteAccountBlock).not.toContain('setShowDeleteConfirm(false)');
    expect(deleteAccountBlock).toContain('throw error;');
    expect(logoutBlock).not.toContain('setShowLogoutConfirm(false)');
    expect(logoutBlock).toContain('throw error;');
  });

  it('supports null-user early returns safely', async () => {
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser: null,
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: vi.fn().mockResolvedValue(null),
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(hook.result.current.canContinueEdit).toBe(false);

    await act(async () => {
      await hook.result.current.saveProfile();
      await hook.result.current.saveAccountPrivacy(false);
    });

    expect(showToastMock).not.toHaveBeenCalled();
    hook.unmount();
  });
});
