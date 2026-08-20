/** Camera recording stops at the public three-minute limit. */
export const PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS = 180;
export const PLACE_MEDIA_MAX_VIDEO_DURATION_MS = PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS * 1000;
/**
 * Device media metadata can drift by a few seconds after transcoding. Existing
 * gallery videos get this small acceptance margin; the in-app camera does not.
 */
export const PLACE_MEDIA_VIDEO_DURATION_TOLERANCE_SECONDS = 3;
export const PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_SECONDS =
  PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS + PLACE_MEDIA_VIDEO_DURATION_TOLERANCE_SECONDS;
export const PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_MS =
  PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_SECONDS * 1000;
export const PLACE_MEDIA_TARGET_VIDEO_QUALITY = '720p' as const;
export const PLACE_MEDIA_TARGET_VIDEO_BITRATE = 5_000_000;
