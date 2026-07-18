import * as Linking from 'expo-linking';
import { NativeModules, Platform } from 'react-native';

import { env } from '@/mobile/app/platform/config/env';

const INSTAGRAM_STORY_SCHEME = 'instagram-stories://share';
const STORY_TOP_BACKGROUND_COLOR = '#3d7cff';
const STORY_BOTTOM_BACKGROUND_COLOR = '#1ecf91';

type SoritaInstagramStoriesModule = {
  shareLink: (
    url: string,
    topBackgroundColor: string,
    bottomBackgroundColor: string,
  ) => Promise<boolean>;
};

export type ShareInstagramStoryLinkResult =
  | { ok: true }
  | {
      message?: string;
      ok: false;
    };

function resolveNativeInstagramStoriesModule() {
  const candidate = (NativeModules as Record<string, unknown>)
    .SoritaInstagramStories as SoritaInstagramStoriesModule | undefined;

  return candidate && typeof candidate.shareLink === 'function' ? candidate : null;
}

export async function shareInstagramStoryLink(
  url: string,
): Promise<ShareInstagramStoryLinkResult> {
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    return {
      ok: false,
      message: 'Paylasim baglantisi hazir degil.',
    };
  }

  try {
    if (Platform.OS === 'android') {
      const nativeInstagramStoriesModule = resolveNativeInstagramStoriesModule();

      if (!nativeInstagramStoriesModule) {
        return {
          ok: false,
          message: 'Instagram Stories bu cihazda hazir degil.',
        };
      }

      await nativeInstagramStoriesModule.shareLink(
        normalizedUrl,
        STORY_TOP_BACKGROUND_COLOR,
        STORY_BOTTOM_BACKGROUND_COLOR,
      );
      return { ok: true };
    }

    if (Platform.OS === 'ios') {
      const facebookAppId = env.facebookAppId?.trim();
      const canOpenInstagramStories = await Linking.canOpenURL(INSTAGRAM_STORY_SCHEME);

      if (!canOpenInstagramStories) {
        return {
          ok: false,
          message: 'Instagram Stories bu cihazda acilamadi.',
        };
      }

      const shareUrl =
        `${INSTAGRAM_STORY_SCHEME}?` +
        `content_url=${encodeURIComponent(normalizedUrl)}` +
        `&top_background_color=${encodeURIComponent(STORY_TOP_BACKGROUND_COLOR)}` +
        `&bottom_background_color=${encodeURIComponent(STORY_BOTTOM_BACKGROUND_COLOR)}` +
        (facebookAppId
          ? `&source_application=${encodeURIComponent(facebookAppId)}`
          : '');

      await Linking.openURL(shareUrl);
      return { ok: true };
    }

    return {
      ok: false,
      message: 'Instagram Stories bu cihazda desteklenmiyor.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Instagram Stories acilamadi.',
    };
  }
}
