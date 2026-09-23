import { Platform, Share } from 'react-native';

import { tr } from '@/mobile/app/shared/i18n/tr';

export type ShareExternalUrlResult =
  | { ok: true }
  | {
      message?: string;
      ok: false;
    };

/**
 * Opens the system share sheet for a link, with an optional line saying what
 * it is. iOS takes the two apart; Android apps receive one text, so the line
 * goes first and the link on its own line, where WhatsApp builds its preview.
 */
export async function shareExternalUrl(
  url: string,
  description?: string,
): Promise<ShareExternalUrlResult> {
  const normalizedUrl = url.trim();
  const normalizedDescription = description?.trim();

  if (!normalizedUrl) {
    return {
      ok: false,
      message: tr.common.shareLinkUnavailable,
    };
  }

  try {
    if (Platform.OS === 'ios') {
      await Share.share(
        normalizedDescription
          ? { message: normalizedDescription, url: normalizedUrl }
          : { url: normalizedUrl },
      );
    } else {
      await Share.share({
        message: normalizedDescription
          ? `${normalizedDescription}\n${normalizedUrl}`
          : normalizedUrl,
      });
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : tr.common.shareOpenFailed,
    };
  }
}
