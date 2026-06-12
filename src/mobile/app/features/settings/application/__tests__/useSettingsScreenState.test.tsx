import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const useUsernameAvailabilityQueryMock = vi.fn();
const showToastMock = vi.fn();
const pickSingleImageMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useAccountAvailabilityQuery', () => ({
  useUsernameAvailabilityQuery: useUsernameAvailabilityQueryMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

vi.mock('@/mobile/app/platform/media/images', () => ({
  pickSingleImage: pickSingleImageMock,
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
    const saveUserProfileMock = vi.fn().mockResolvedValue(undefined);
    const refreshCurrentUserStateMock = vi.fn().mockResolvedValue({
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Ada Lovelace',
      username: 'adal',
      bio: 'bio',
      interests: ['coffee'],
      isPublicAccount: true,
    });
    pickSingleImageMock
      .mockResolvedValueOnce('file://profile.jpg')
      .mockResolvedValueOnce('file://cover.jpg');
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser: {
          id: 'viewer',
          email: 'viewer@example.com',
          name: 'Viewer',
          username: 'viewer',
          bio: 'old bio',
          interests: ['coffee'],
          isPublicAccount: true,
        },
        logout: vi.fn().mockResolvedValue(undefined),
        persistAccountPrivacy: vi.fn().mockResolvedValue(undefined),
        refreshCurrentUserState: refreshCurrentUserStateMock,
        requestPasswordReset: vi.fn().mockResolvedValue({ success: true }),
        saveUserProfile: saveUserProfileMock,
      }),
    );

    act(() => {
      hook.result.current.openEditProfile();
    });

    await waitFor(() => {
      expect(hook.result.current.view).toBe('editProfile');
    });

    act(() => {
      hook.result.current.setEditName('Ada Lovelace');
      hook.result.current.updateEditUsername('Ada!');
      hook.result.current.setEditBio(' Loves coffee ');
      hook.result.current.toggleInterest('music');
      hook.result.current.goToNextEditStep();
      hook.result.current.goToPreviousEditStep();
    });

    await act(async () => {
      await hook.result.current.selectProfilePhoto();
      await hook.result.current.selectCoverPhoto();
      await hook.result.current.saveProfile();
    });

    expect(pickSingleImageMock).toHaveBeenCalledTimes(2);
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
  });

  it('exposes a saving state and message while the profile request is in flight', async () => {
    const deferredSave = createDeferred<void>();
    const saveUserProfileMock = vi.fn().mockReturnValue(deferredSave.promise);
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser: {
          id: 'viewer',
          email: 'viewer@example.com',
          name: 'Viewer',
          username: 'viewer',
          bio: 'old bio',
          interests: ['coffee'],
          isPublicAccount: true,
        },
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

    let savePromise: Promise<void> | undefined;

    await act(async () => {
      savePromise = hook.result.current.saveProfile();
      await Promise.resolve();
    });

    expect(hook.result.current.isSavingProfile).toBe(true);
    expect(hook.result.current.saveProfileMessage).toContain('Fotograflarin yukleniyor');

    deferredSave.resolve(undefined);

    await act(async () => {
      await savePromise;
    });

    expect(hook.result.current.isSavingProfile).toBe(false);
    expect(hook.result.current.saveProfileMessage).toBe('');
  });

  it('covers helper tones, navigation views, and photo clearing', async () => {
    useUsernameAvailabilityQueryMock.mockReturnValue({
      availability: { status: 'idle', message: 'idle' },
    });
    pickSingleImageMock.mockResolvedValueOnce(null).mockResolvedValueOnce('file://cover.jpg');
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser: {
          id: 'viewer',
          email: 'viewer@example.com',
          name: 'Viewer',
          username: 'viewer',
          isPublicAccount: true,
        },
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
    const saveUserProfileMock = vi.fn().mockRejectedValue(new Error('save failed'));
    const hooks = await import('@/mobile/app/features/settings/application/useSettingsScreenState');
    const hook = renderHook(() =>
      hooks.useSettingsScreenState({
        deleteCurrentUser: vi.fn().mockResolvedValue(undefined),
        freshUser: {
          id: 'viewer',
          email: 'viewer@example.com',
          name: 'Viewer',
          username: 'viewer',
          isPublicAccount: true,
        },
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
    const persistAccountPrivacyMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('privacy failed'));
    const logoutMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('logout failed'));
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
        freshUser: {
          id: 'viewer',
          email: 'viewer@example.com',
          name: 'Viewer',
          username: 'viewer',
          isPublicAccount: true,
        },
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

    await act(async () => {
      await hook.result.current.deleteAccount();
      await hook.result.current.handleLogout();
      await hook.result.current.handleLogout();
    });

    expect(deleteCurrentUserMock).toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalled();
    expect(requestPasswordResetMock).toHaveBeenCalledWith('current-password');
    expect(hook.result.current.resetMailSent).toBe(true);
    expect(showToastMock).toHaveBeenCalled();
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
  });
});
