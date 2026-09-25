import React from 'react';
import { Image as ImageIcon, List, MapPin } from 'lucide-react-native';

import type { ProfileContentTab } from '@/mobile/app/features/profile/ui/components/ProfileContentPager';
import type { ProfileTabOption } from '@/mobile/app/features/profile/ui/components/ProfileTabs';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

type ProfileTabCounts = {
  gallery?: number;
  lists?: number;
  places?: number;
};

/**
 * What a profile tab may claim as its count. Content arrives 24 items a page
 * and only once its tab is opened, so the loaded length read "0" before the
 * tab was visited and "24" for anyone with more. Once every page is in the
 * loaded length is exact; until then only the server's total is, and a tab
 * without one shows no number rather than a wrong one.
 */
export function resolveProfileTabCount({
  complete,
  loaded,
  total,
}: {
  complete: boolean;
  loaded: number;
  total?: number;
}) {
  return complete ? loaded : total;
}

// Each tab keeps one icon, in the tab bar and on its empty state.
export const PROFILE_TAB_ICONS = {
  gallery: ImageIcon,
  lists: List,
  places: MapPin,
} satisfies Record<ProfileContentTab, typeof List>;

function tabIconColor(active: boolean) {
  return active ? colors.primary : colors.textSoft;
}

export function buildProfileTabOptions(counts: ProfileTabCounts): ProfileTabOption[] {
  return [
    {
      key: 'lists',
      label: tr.profile.tabs.lists,
      count: counts.lists,
      renderIcon: (active) => <PROFILE_TAB_ICONS.lists color={tabIconColor(active)} size={iconSize.xs} />,
    },
    {
      key: 'places',
      label: tr.profile.tabs.places,
      count: counts.places,
      renderIcon: (active) => <PROFILE_TAB_ICONS.places color={tabIconColor(active)} size={iconSize.xs} />,
    },
    {
      key: 'gallery',
      label: tr.profile.tabs.gallery,
      count: counts.gallery,
      renderIcon: (active) => <PROFILE_TAB_ICONS.gallery color={tabIconColor(active)} size={iconSize.xs} />,
    },
  ];
}
