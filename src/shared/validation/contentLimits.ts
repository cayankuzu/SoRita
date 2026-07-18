/**
 * Content validation limits shared between mobile app and edge functions.
 * Single source of truth for all content length/count constraints.
 */

const PLACE_MEDIA_TARGET_VIDEO_BITRATE = 5_000_000;
const PLACE_MEDIA_AUDIO_BITRATE_HEADROOM = 192_000;
const PLACE_MEDIA_CONTAINER_HEADROOM_RATIO = 1.15;
const PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS = 60;
const PLACE_MEDIA_UPLOAD_SIZE_HEADROOM_SECONDS = 5;

const max720pVideoSizeBytes = Math.ceil(
  ((PLACE_MEDIA_TARGET_VIDEO_BITRATE + PLACE_MEDIA_AUDIO_BITRATE_HEADROOM) *
    (PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS + PLACE_MEDIA_UPLOAD_SIZE_HEADROOM_SECONDS) *
    PLACE_MEDIA_CONTAINER_HEADROOM_RATIO) /
    8,
);

export const limits = {
  // User profile
  username: { min: 3, max: 30 },
  displayName: { min: 1, max: 50 },
  bio: { min: 0, max: 300 },
  password: { min: 8, max: 128 },

  // Lists
  listTitle: { min: 1, max: 60 },
  listDescription: { min: 0, max: 300 },
  maxListsPerUser: 50,
  maxPlacesPerList: 200,

  // Places
  placeName: { min: 1, max: 80 },
  placeShortTitle: { min: 0, max: 60 },
  placeMenuUrl: { min: 0, max: 2048 },
  placeNotes: { min: 0, max: 1000 },
  placeAddress: { min: 0, max: 200 },
  maxPhotosPerPlace: 6,
  maxVideosPerPlace: 2,
  maxMediaPerPlace: 6,

  // Comments
  comment: { min: 1, max: 500 },
  commentEditWindowMs: 3 * 60 * 1000, // 3 minutes

  // Media
  maxImageSizeBytes: 30 * 1024 * 1024, // 30MB
  maxVideoSizeBytes: max720pVideoSizeBytes, // 720p, 60 seconds + 5 seconds upload headroom
  maxVideoDurationMs: 60 * 1000, // 60 seconds

  // Reports
  reportReason: { min: 1, max: 500 },

  // Rate limiting
  maxFollowsPerMinute: 30,
  maxCommentsPerMinute: 10,
  maxLikesPerMinute: 60,
  maxUploadsPerMinute: 120,
} as const;

export type ContentLimits = typeof limits;
