import { describe, expect, it } from 'vitest';

import {
  AUTH_BOOTSTRAP_SHELL_FALLBACK_MS,
  IMAGE_CROSSFADE_MS,
  MEDIA_INITIAL_PREFETCH_CARD_COUNT,
  MEDIA_PREFETCH_AHEAD_CARD_COUNT,
  MEDIA_PREFETCH_VIEWABILITY_DELAY_MS,
  NAVIGATION_STATE_RESTORE_BUDGET_MS,
  STARTUP_CACHE_RESTORE_BUDGET_MS,
  performanceBudgets,
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
    expect(MEDIA_INITIAL_PREFETCH_CARD_COUNT).toBeGreaterThanOrEqual(3);
    expect(MEDIA_PREFETCH_AHEAD_CARD_COUNT).toBeGreaterThanOrEqual(3);
    expect(MEDIA_PREFETCH_VIEWABILITY_DELAY_MS).toBeLessThanOrEqual(75);
    expect(VIDEO_START_BUFFER_SECONDS).toBeLessThanOrEqual(1);
    expect(VIDEO_FORWARD_BUFFER_SECONDS).toBeGreaterThanOrEqual(6);
    expect(VIDEO_CACHE_LOW_MEMORY_BYTES).toBeLessThan(VIDEO_CACHE_DEFAULT_BYTES);
    expect(performanceBudgets).toEqual({
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
    });
  });
});
