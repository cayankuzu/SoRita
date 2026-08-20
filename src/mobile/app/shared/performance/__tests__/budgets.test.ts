import { describe, expect, it } from 'vitest';

import {
  AUTH_BOOTSTRAP_SHELL_FALLBACK_MS,
  HOME_FEED_INITIAL_RENDER_COUNT,
  HOME_FEED_RENDER_BATCH_SIZE,
  HOME_FEED_WINDOW_SIZE,
  IMAGE_CROSSFADE_MS,
  MEDIA_PREFETCH_AHEAD_CARD_COUNT,
  MEDIA_PREFETCH_VIEWABILITY_DELAY_MS,
  NAVIGATION_STATE_RESTORE_BUDGET_MS,
  STARTUP_CACHE_RESTORE_BUDGET_MS,
  performanceBudgets,
  releasePerformanceBudgets,
  VIDEO_FORWARD_BUFFER_SECONDS,
  VIDEO_CACHE_DEFAULT_BYTES,
  VIDEO_CACHE_LOW_MEMORY_BYTES,
  VIDEO_START_BUFFER_SECONDS,
} from '@/mobile/app/shared/performance/budgets';

describe('performance budgets', () => {
  it('keeps startup and presentation latency within their release budgets', () => {
    expect(AUTH_BOOTSTRAP_SHELL_FALLBACK_MS).toBeGreaterThan(0);
    expect(AUTH_BOOTSTRAP_SHELL_FALLBACK_MS).toBeLessThanOrEqual(1_000);
    expect(STARTUP_CACHE_RESTORE_BUDGET_MS).toBeGreaterThan(0);
    expect(STARTUP_CACHE_RESTORE_BUDGET_MS).toBeLessThanOrEqual(50);
    expect(NAVIGATION_STATE_RESTORE_BUDGET_MS).toBeGreaterThan(0);
    expect(NAVIGATION_STATE_RESTORE_BUDGET_MS).toBeLessThanOrEqual(150);
    expect(IMAGE_CROSSFADE_MS).toBeGreaterThan(0);
    expect(IMAGE_CROSSFADE_MS).toBeLessThanOrEqual(100);
    expect(HOME_FEED_INITIAL_RENDER_COUNT).toBeLessThanOrEqual(2);
    expect(HOME_FEED_RENDER_BATCH_SIZE).toBeLessThanOrEqual(3);
    expect(HOME_FEED_WINDOW_SIZE).toBeLessThanOrEqual(4);
    expect(MEDIA_PREFETCH_AHEAD_CARD_COUNT).toBeLessThanOrEqual(2);
    expect(MEDIA_PREFETCH_VIEWABILITY_DELAY_MS).toBeGreaterThanOrEqual(100);
    expect(VIDEO_START_BUFFER_SECONDS).toBeLessThanOrEqual(1);
    expect(VIDEO_FORWARD_BUFFER_SECONDS).toBeGreaterThanOrEqual(6);
    expect(VIDEO_CACHE_LOW_MEMORY_BYTES).toBeLessThan(VIDEO_CACHE_DEFAULT_BYTES);
    expect(releasePerformanceBudgets.coldStartMs).toBeLessThanOrEqual(2_500);
    expect(releasePerformanceBudgets.droppedFrameRatio).toBeLessThanOrEqual(0.05);
    expect(releasePerformanceBudgets.navigationMs).toBeLessThanOrEqual(500);
    expect(performanceBudgets).toEqual({
      authBootstrapShellFallbackMs: AUTH_BOOTSTRAP_SHELL_FALLBACK_MS,
      startupCacheRestoreMs: STARTUP_CACHE_RESTORE_BUDGET_MS,
      imageCrossfadeMs: IMAGE_CROSSFADE_MS,
      homeFeedInitialRenderCount: HOME_FEED_INITIAL_RENDER_COUNT,
      homeFeedRenderBatchSize: HOME_FEED_RENDER_BATCH_SIZE,
      homeFeedWindowSize: HOME_FEED_WINDOW_SIZE,
      mediaPrefetchAheadCardCount: MEDIA_PREFETCH_AHEAD_CARD_COUNT,
      mediaPrefetchViewabilityDelayMs: MEDIA_PREFETCH_VIEWABILITY_DELAY_MS,
      navigationStateRestoreMs: NAVIGATION_STATE_RESTORE_BUDGET_MS,
      release: releasePerformanceBudgets,
      videoForwardBufferSeconds: VIDEO_FORWARD_BUFFER_SECONDS,
      videoCacheDefaultBytes: VIDEO_CACHE_DEFAULT_BYTES,
      videoCacheLowMemoryBytes: VIDEO_CACHE_LOW_MEMORY_BYTES,
      videoStartBufferSeconds: VIDEO_START_BUFFER_SECONDS,
    });
  });
});
