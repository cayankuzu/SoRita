import React from 'react';
import { Copy, Share2 } from 'lucide-react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { iconSize } from '@/mobile/app/shared/theme/tokens';
import { buildListContentUrl } from '@/mobile/app/shared/utils/contentLinks';

type ShareableList = Pick<PlaceList, 'emoji' | 'id' | 'isPublic' | 'name'>;

async function shareListLink(url: string, list: ShareableList) {
  const { shareExternalUrl } = await import('@/mobile/app/platform/sharing/shareExternalUrl');
  const title = list.emoji ? `${list.emoji} ${list.name}` : list.name;
  const result = await shareExternalUrl(url, tr.cards.shareDescription(title));

  if (!result.ok) {
    showToast(result.message || tr.common.shareLinkUnavailable, 'error');
  }
}

async function copyListLink(url: string) {
  try {
    const { setStringAsync } = await import('expo-clipboard');
    await setStringAsync(url);
    showToast(tr.cards.copyLinkSuccess, 'success');
  } catch {
    showToast(tr.cards.copyLinkFailed, 'error');
  }
}

// A public list is passed on like a place: its link opens the list in the
// app. A private list's link would open for nobody else, so it offers none.
export function buildListShareMenuItems(list: ShareableList, closeMenu: () => void) {
  if (!list.isPublic) {
    return [];
  }

  const url = buildListContentUrl(list.id);

  return [
    {
      key: 'share',
      label: tr.cards.share,
      renderIcon: (color: string) => <Share2 color={color} size={iconSize.sm} />,
      onPress: () => {
        closeMenu();
        void shareListLink(url, list);
      },
    },
    {
      key: 'copy-link',
      label: tr.cards.copyLink,
      renderIcon: (color: string) => <Copy color={color} size={iconSize.sm} />,
      onPress: () => {
        closeMenu();
        void copyListLink(url);
      },
    },
  ];
}
