import { Platform, Share } from 'react-native';

import { tr } from '@/mobile/app/shared/i18n/tr';

export type ShareExternalUrlResult =
  | { ok: true }
  | {
      message?: string;
      ok: false;
    };

export async function shareExternalUrl(url: string): Promise<ShareExternalUrlResult> {
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    return {
      ok: false,
      message: tr.common.shareLinkUnavailable,
    };
  }

  try {
    if (Platform.OS === 'ios') {
      await Share.share({ url: normalizedUrl });
    } else {
      await Share.share({ message: normalizedUrl });
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : tr.common.shareOpenFailed,
    };
  }
}
