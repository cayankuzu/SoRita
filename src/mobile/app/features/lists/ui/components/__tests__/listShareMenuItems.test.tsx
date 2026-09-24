import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharing = vi.hoisted(() => ({ share: vi.fn() }));
const clipboard = vi.hoisted(() => ({ setStringAsync: vi.fn() }));
const toast = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock('lucide-react-native', () => ({
  Copy: (props: Record<string, unknown>) => React.createElement('Copy', props),
  Share2: (props: Record<string, unknown>) => React.createElement('Share2', props),
}));
vi.mock('@/mobile/app/platform/sharing/shareExternalUrl', () => ({
  shareExternalUrl: sharing.share,
}));
vi.mock('expo-clipboard', () => clipboard);
vi.mock('@/mobile/app/platform/feedback/toast', () => ({ showToast: toast.show }));
vi.mock('@/mobile/app/shared/utils/contentLinks', () => ({
  buildListContentUrl: (listId: string) => `https://sorita.test/lists/${listId}`,
}));

import { buildListShareMenuItems } from '@/mobile/app/features/lists/ui/components/listShareMenuItems';
import { tr } from '@/mobile/app/shared/i18n/tr';

const publicList = { emoji: '☕', id: 'list-1', isPublic: true, name: 'Kafesel' };

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('buildListShareMenuItems', () => {
  beforeEach(() => {
    sharing.share.mockReset();
    clipboard.setStringAsync.mockReset();
    toast.show.mockReset();
  });

  it('offers nothing for a private list, whose link would open for nobody else', () => {
    expect(buildListShareMenuItems({ ...publicList, isPublic: false }, vi.fn())).toEqual([]);
  });

  it('shares a public list through the system sheet, with its name', async () => {
    sharing.share.mockResolvedValue({ ok: true });
    const closeMenu = vi.fn();
    const [share] = buildListShareMenuItems(publicList, closeMenu);

    share?.onPress();
    await settle();

    expect(closeMenu).toHaveBeenCalledOnce();
    expect(sharing.share).toHaveBeenCalledWith(
      'https://sorita.test/lists/list-1',
      tr.cards.shareDescription('☕ Kafesel'),
    );
    expect(toast.show).not.toHaveBeenCalled();

    sharing.share.mockResolvedValue({ ok: false });
    share?.onPress();
    await settle();
    expect(toast.show).toHaveBeenCalledWith(tr.common.shareLinkUnavailable, 'error');
  });

  it('copies the link and says whether it worked', async () => {
    const [, copy] = buildListShareMenuItems(publicList, vi.fn());

    clipboard.setStringAsync.mockResolvedValue(true);
    copy?.onPress();
    await settle();
    expect(clipboard.setStringAsync).toHaveBeenCalledWith('https://sorita.test/lists/list-1');
    expect(toast.show).toHaveBeenLastCalledWith(tr.cards.copyLinkSuccess, 'success');

    clipboard.setStringAsync.mockRejectedValue(new Error('no clipboard'));
    copy?.onPress();
    await settle();
    expect(toast.show).toHaveBeenLastCalledWith(tr.cards.copyLinkFailed, 'error');
  });
});
