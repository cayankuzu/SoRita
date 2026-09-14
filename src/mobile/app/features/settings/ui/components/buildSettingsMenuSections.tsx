import React from 'react';

import {
  Ban,
  Lock,
  LogOut,
  Palette,
  Shield,
  Trash2,
  User as UserIcon,
} from 'lucide-react-native';

import type { SettingsMenuItem } from '@/mobile/app/features/settings/ui/components/SettingsMenuSection';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type BuildSettingsMenuSectionsParams = {
  exportPersonalData: () => void;
  isExportingPersonalData: boolean;
  openBlocked: () => void;
  openDeveloperCatalog: () => void;
  openEditProfile: () => void;
  openPassword: () => void;
  openPrivacy: () => void;
  requestDeleteAccount: () => void;
  requestLogout: () => void;
};

export function buildSettingsMenuSections({
  exportPersonalData,
  isExportingPersonalData,
  openBlocked,
  openDeveloperCatalog,
  openEditProfile,
  openPassword,
  openPrivacy,
  requestDeleteAccount,
  requestLogout,
}: BuildSettingsMenuSectionsParams): Array<{ title: string; items: SettingsMenuItem[] }> {
  const sections: Array<{ title: string; items: SettingsMenuItem[] }> = [
    {
      title: tr.settings.sections.account,
      items: [
        {
          icon: <UserIcon color={colors.primary} size={18} />,
          label: tr.settings.editProfile.title,
          color: colors.primaryBg,
          action: openEditProfile,
        },
        {
          icon: <Shield color={colors.secondary} size={18} />,
          label: tr.settings.privacy.title,
          color: colors.successBg,
          action: openPrivacy,
        },
        {
          icon: <Lock color={colors.primary} size={18} />,
          label: tr.settings.password.title,
          color: colors.primaryBg,
          action: openPassword,
        },
      ],
    },
    {
      title: tr.settings.sections.other,
      items: [
        {
          icon: <Ban color={colors.textMuted} size={18} />,
          label: tr.settings.blocked.title,
          color: colors.surfaceMuted,
          action: openBlocked,
        },
        {
          icon: <Shield color={colors.primary} size={18} />,
          label: tr.settings.personalDataExport,
          color: colors.primaryBg,
          action: exportPersonalData,
          disabled: isExportingPersonalData,
        },
        {
          icon: <LogOut color={colors.textMuted} size={18} />,
          label: tr.settings.logout,
          color: colors.surfaceMuted,
          action: requestLogout,
        },
        {
          icon: <Trash2 color={colors.danger} size={18} />,
          label: tr.settings.deleteAccount,
          color: colors.dangerBg,
          action: requestDeleteAccount,
          danger: true,
        },
      ],
    },
  ];

  if (__DEV__) {
    sections.push({
      title: tr.uiCatalog.developerSection,
      items: [
        {
          icon: <Palette color={colors.purple} size={18} />,
          label: tr.uiCatalog.title,
          color: colors.purpleBg,
          action: openDeveloperCatalog,
        },
      ],
    });
  }

  return sections;
}
