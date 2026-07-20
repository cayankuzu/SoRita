/**
 * User-visible latency budgets. These are hard upper bounds or presentation
 * timings, never minimum waits on completed work.
 */
export const AUTH_BOOTSTRAP_SHELL_FALLBACK_MS = 900;
export const STARTUP_CACHE_RESTORE_BUDGET_MS = 45;
export const NAVIGATION_STATE_RESTORE_BUDGET_MS = 120;
export const IMAGE_CROSSFADE_MS = 90;
export const MEDIA_INITIAL_PREFETCH_CARD_COUNT = 4;
export const MEDIA_PREFETCH_AHEAD_CARD_COUNT = 4;
export const MEDIA_PREFETCH_VIEWABILITY_DELAY_MS = 60;
export const VIDEO_FORWARD_BUFFER_SECONDS = 8;
export const VIDEO_START_BUFFER_SECONDS = 0.75;
export const VIDEO_CACHE_LOW_MEMORY_BYTES = 128 * 1024 * 1024;
export const VIDEO_CACHE_DEFAULT_BYTES = 256 * 1024 * 1024;

export const performanceBudgets = {
  authBootstrapShellFallbackMs: AUTH_BOOTSTRAP_SHELL_FALLBACK_MS,
  startupCacheRestoreMs: STARTUP_CACHE_RESTORE_BUDGET_MS,
  imageCrossfadeMs: IMAGE_CROSSFADE_MS,
  mediaInitialPrefetchCardCount: MEDIA_INITIAL_PREFETCH_CARD_COUNT,
  mediaPrefetchAheadCardCount: MEDIA_PREFETCH_AHEAD_CARD_COUNT,
  mediaPrefetchViewabilityDelayMs: MEDIA_PREFETCH_VIEWABILITY_DELAY_MS,
  navigationStateRestoreMs: NAVIGATION_STATE_RESTORE_BUDGET_MS,
  videoForwardBufferSeconds: VIDEO_FORWARD_BUFFER_SECONDS,
  videoCacheDefaultBytes: VIDEO_CACHE_DEFAULT_BYTES,
  videoCacheLowMemoryBytes: VIDEO_CACHE_LOW_MEMORY_BYTES,
  videoStartBufferSeconds: VIDEO_START_BUFFER_SECONDS,
} as const;
