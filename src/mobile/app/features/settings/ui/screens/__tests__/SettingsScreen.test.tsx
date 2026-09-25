import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const goToMain = vi.fn();

const freshUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Ada',
  username: 'ada',
  bio: 'Original bio',
  interests: ['travel'],
  profilePhoto: undefined,
  coverPhoto: undefined,
  isPublicAccount: true,
};

const settingsState = {
  canContinueEdit: true,
  clearCoverPhoto: vi.fn(),
  clearProfilePhoto: vi.fn(),
  coverPhoto: undefined,
  currentPassword: '',
  deleteAccount: vi.fn(),
  editBio: 'Changed bio',
  editInterests: ['travel'],
  editName: 'Ada',
  editStep: 0,
  editUsername: 'ada',
  goToMain,
  goToNextEditStep: vi.fn(),
  goToPreviousEditStep: vi.fn(),
  handleLogout: vi.fn(),
  isPasswordResetCoolingDown: false,
  isPublicAccount: true,
  isSavingPrivacy: false,
  isSavingProfile: false,
  isSendingPasswordReset: false,
  openBlocked: vi.fn(),
  openEditProfile: vi.fn(),
  openPassword: vi.fn(),
  openPrivacy: vi.fn(),
  passwordResetError: null,
  profilePhoto: undefined,
  resetMailSent: false,
  saveAccountPrivacy: vi.fn(),
  saveProfile: vi.fn(),
  saveProfileMessage: null,
  selectCoverPhoto: vi.fn(),
  selectProfilePhoto: vi.fn(),
  sendPasswordResetMail: vi.fn(),
  setCurrentPassword: vi.fn(),
  setEditBio: vi.fn(),
  setEditName: vi.fn(),
  setShowDeleteConfirm: vi.fn(),
  setShowLogoutConfirm: vi.fn(),
  setShowPassword: vi.fn(),
  showDeleteConfirm: false,
  showLogoutConfirm: false,
  showPassword: false,
  toggleInterest: vi.fn(),
  updateEditUsername: vi.fn(),
  usernameHelper: '',
  usernameHelperTone: 'muted' as const,
  view: 'editProfile' as 'editProfile' | 'main',
};

vi.mock('@/mobile/app/app-shell/auth/AuthSessionProvider', () => ({
  useAuth: () => ({
    user: freshUser,
    logout: vi.fn(),
    refreshUser: vi.fn(),
    requestPasswordReset: vi.fn(),
  }),
}));

vi.mock('@/mobile/app/platform/config/appVersion', () => ({
  getInstalledAppVersionLabel: () => '1.0.110 (116)',
}));
vi.mock('@/mobile/app/app-shell/navigation/navigation', () => ({
  openStackScreen: vi.fn(),
  useAppNavigation: () => ({ goBack: vi.fn(), navigate: vi.fn() }),
}));

vi.mock('@/mobile/app/features/settings/application/useSettingsAccountState', () => ({
  useSettingsAccountState: () => ({
    blockedUsers: [],
    deleteCurrentUser: vi.fn(),
    freshUser,
    onRefresh: vi.fn(),
    refreshing: false,
    refreshCurrentUserState: vi.fn(),
    saveAccountPrivacy: vi.fn(),
    saveUserProfile: vi.fn(),
  }),
}));

vi.mock('@/mobile/app/features/settings/application/useSettingsScreenState', () => ({
  useSettingsScreenState: () => settingsState,
}));

vi.mock('@/mobile/app/features/settings/ui/components/SettingsEditProfileFlow', () => ({
  SettingsEditProfileFlow: (props: Record<string, unknown>) =>
    React.createElement('SettingsEditProfileFlow', props),
}));

vi.mock('@/mobile/app/features/settings/ui/components/SettingsBlockedUsersView', () => ({
  SettingsBlockedUsersView: (props: Record<string, unknown>) =>
    React.createElement('SettingsBlockedUsersView', props),
}));

vi.mock('@/mobile/app/features/settings/ui/components/SettingsMainMenuView', () => ({
  SettingsMainMenuView: (props: Record<string, unknown>) =>
    React.createElement('SettingsMainMenuView', props),
}));

vi.mock('@/mobile/app/features/settings/ui/components/SettingsPasswordView', () => ({
  SettingsPasswordView: (props: Record<string, unknown>) =>
    React.createElement('SettingsPasswordView', props),
}));

vi.mock('@/mobile/app/features/settings/ui/components/SettingsPrivacyView', () => ({
  SettingsPrivacyView: (props: Record<string, unknown>) =>
    React.createElement('SettingsPrivacyView', props),
}));

vi.mock('@/mobile/app/features/auth/public/legal', () => ({
  LegalDocumentSheet: (props: Record<string, unknown>) =>
    React.createElement('LegalDocumentSheet', props),
}));

vi.mock('@/mobile/app/shared/components/feedback/ConfirmActionModal', () => ({
  ConfirmActionModal: (props: Record<string, unknown>) =>
    React.createElement('ConfirmActionModal', props),
}));

vi.mock('@/mobile/app/shared/components/ui/Screen', () => ({
  Screen: (props: Record<string, unknown>) => React.createElement('Screen', props),
}));

vi.mock('@/mobile/app/shared/hooks/useAndroidBackHandler', () => ({
  useAndroidBackHandler: vi.fn(),
}));

vi.mock('lucide-react-native', () => ({
  Ban: () => null,
  Download: () => null,
  FileText: () => null,
  Lock: () => null,
  LogOut: () => null,
  Palette: () => null,
  Scale: () => null,
  Shield: () => null,
  ShieldCheck: () => null,
  Trash2: () => null,
  User: () => null,
  Users: () => null,
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    goToMain.mockClear();
  });

  it('shows the discard confirmation before leaving a dirty profile editor', async () => {
    const { SettingsScreen } = await import('../SettingsScreen');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<SettingsScreen />);
    });

    const editor = renderer.root.findByType(
      'SettingsEditProfileFlow' as unknown as React.ElementType,
    );

    act(() => {
      editor.props.onCancel();
    });

    const modal = renderer.root.findByType(
      'ConfirmActionModal' as unknown as React.ElementType,
    );
    expect(modal.props.visible).toBe(true);
    expect(goToMain).not.toHaveBeenCalled();
  });

  it('shows the installed build under the menu', async () => {
    settingsState.view = 'main';
    const { SettingsScreen } = await import('../SettingsScreen');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<SettingsScreen />);
    });

    const menu = renderer.root.findByType('SettingsMainMenuView' as unknown as React.ElementType);
    expect(menu.props.versionLabel).toBe('1.0.110 (116)');
    settingsState.view = 'editProfile';
  });

  it('opens each sign-up document again from the Yasal group', async () => {
    settingsState.view = 'main';
    const { SettingsScreen } = await import('../SettingsScreen');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<SettingsScreen />);
    });

    const menu = renderer.root.findByType('SettingsMainMenuView' as unknown as React.ElementType);
    const legal = (menu.props.sections as Array<{ title: string; items: Array<{ label: string; action: () => void }> }>)
      .find((section) => section.title === 'Yasal');
    expect(legal?.items.map((item) => item.label)).toEqual([
      'Kullanım Koşulları',
      'Topluluk Kuralları',
      'Gizlilik Politikası',
      'KVKK Aydınlatma Metni',
    ]);
    expect(renderer.root.findAllByType('LegalDocumentSheet' as unknown as React.ElementType)).toHaveLength(0);

    act(() => legal?.items[2]?.action());
    const sheet = renderer.root.findByType('LegalDocumentSheet' as unknown as React.ElementType);
    expect(sheet.props.documentId).toBe('privacy');

    act(() => (sheet.props.onClose as () => void)());
    expect(renderer.root.findAllByType('LegalDocumentSheet' as unknown as React.ElementType)).toHaveLength(0);
    settingsState.view = 'editProfile';
  });
});
