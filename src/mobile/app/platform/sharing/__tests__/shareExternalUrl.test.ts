import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactNative = vi.hoisted(() => ({
  Platform: { OS: 'android' as 'android' | 'ios' },
  Share: { share: vi.fn() },
}));

vi.mock('react-native', () => reactNative);

import { shareExternalUrl } from '@/mobile/app/platform/sharing/shareExternalUrl';
import { tr } from '@/mobile/app/shared/i18n/tr';

const url = 'https://cayankuzu.github.io/SoRita_web/lists/?listId=list-42';

describe('shareExternalUrl', () => {
  beforeEach(() => {
    reactNative.Share.share.mockReset();
    reactNative.Share.share.mockResolvedValue({ action: 'sharedAction' });
  });

  it('puts the description first and the link on its own line on Android', async () => {
    reactNative.Platform.OS = 'android';

    await expect(shareExternalUrl(url, "Brauner coffe — SoRita'da keşfet")).resolves.toEqual({
      ok: true,
    });
    expect(reactNative.Share.share).toHaveBeenCalledWith({
      message: `Brauner coffe — SoRita'da keşfet
${url}`,
    });
  });

  it('hands iOS the description and the link separately', async () => {
    reactNative.Platform.OS = 'ios';

    await shareExternalUrl(url, 'Brauner coffe');
    expect(reactNative.Share.share).toHaveBeenCalledWith({ message: 'Brauner coffe', url });
  });

  it('shares the bare link without a description, and refuses an empty one', async () => {
    reactNative.Platform.OS = 'android';

    await shareExternalUrl(` ${url} `);
    expect(reactNative.Share.share).toHaveBeenCalledWith({ message: url });
    await expect(shareExternalUrl('  ')).resolves.toEqual({
      ok: false,
      message: tr.common.shareLinkUnavailable,
    });
  });

  it('reports a share sheet that fails to open', async () => {
    reactNative.Share.share.mockRejectedValueOnce(new Error('no activity'));

    await expect(shareExternalUrl(url)).resolves.toEqual({ ok: false, message: 'no activity' });
  });
});
