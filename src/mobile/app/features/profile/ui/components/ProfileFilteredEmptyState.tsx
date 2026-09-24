import React from 'react';
import { SlidersHorizontal } from 'lucide-react-native';

import type { ProfileContentTab } from '@/mobile/app/features/profile/ui/components/ProfileContentPager';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

type ProfileFilteredEmptyStateProps = {
  onShowAll: () => void;
  tab: ProfileContentTab;
  visibility: 'private' | 'public';
};

// A visibility filter left the tab empty. "Henüz listen yok" there read as if
// the lists were gone; this names the filter and offers the way back.
export function ProfileFilteredEmptyState({
  onShowAll,
  tab,
  visibility,
}: ProfileFilteredEmptyStateProps) {
  return (
    <EmptyState
      icon={<SlidersHorizontal color={colors.textSoft} size={iconSize.xl} />}
      title={tr.profile.empty.filteredTitle(tab, visibility)}
      description={tr.profile.empty.filteredDescription}
      actionLabel={tr.profile.empty.showAll}
      onAction={onShowAll}
    />
  );
}
