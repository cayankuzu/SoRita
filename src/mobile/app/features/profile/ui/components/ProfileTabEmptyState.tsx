import React from 'react';

import type { ProfileContentTab } from '@/mobile/app/features/profile/ui/components/ProfileContentPager';
import { PROFILE_TAB_ICONS } from '@/mobile/app/features/profile/ui/components/profileTabOptions';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

const COPY = {
  own: {
    gallery: [tr.profile.empty.myNoPhoto, tr.profile.empty.myNoPhotoDescription],
    lists: [tr.profile.empty.myNoList, tr.profile.empty.myNoListDescription],
    places: [tr.profile.empty.myNoPlace, tr.profile.empty.myNoPlaceDescription],
  },
  other: {
    gallery: [tr.profile.empty.publicNoPhoto, tr.profile.empty.publicNoPhotoDescription],
    lists: [tr.profile.empty.publicNoList, tr.profile.empty.publicNoListDescription],
    places: [tr.profile.empty.publicNoPlace, tr.profile.empty.publicNoPlaceDescription],
  },
} satisfies Record<'other' | 'own', Record<ProfileContentTab, [string, string]>>;

// An empty profile tab, with the tab's own icon: your profile invites you to
// add, another person's says there is nothing shared yet.
export function ProfileTabEmptyState({
  tab,
  whose,
}: {
  tab: ProfileContentTab;
  whose: 'other' | 'own';
}) {
  const Icon = PROFILE_TAB_ICONS[tab];
  const [title, description] = COPY[whose][tab];

  return (
    <EmptyState
      icon={<Icon color={colors.textSoft} size={iconSize.xl} />}
      title={title}
      description={description}
    />
  );
}
