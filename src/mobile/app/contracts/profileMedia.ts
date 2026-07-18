export const PROFILE_HERO_COVER_HEIGHT = 168;
export const PROFILE_HERO_AVATAR_SIZE = 96;
export const PROFILE_MEDIA_COVER_SOURCE_ASPECT_RATIO = 21 / 9;

export function getProfileHeroCoverViewportHeight(previewWidth: number, screenWidth: number) {
  if (previewWidth <= 0 || screenWidth <= 0) {
    return 0;
  }

  return previewWidth * (PROFILE_HERO_COVER_HEIGHT / screenWidth);
}
