import { beforeEach, describe, expect, it, vi } from 'vitest';

type FeatureFlags = Record<string, boolean | string>;

const posthogSdk = vi.hoisted(() => ({
  capture: vi.fn((_name: string, _properties?: Record<string, unknown>) => undefined),
  flush: vi.fn(() => Promise.resolve()),
  optIn: vi.fn(() => Promise.resolve()),
  optOut: vi.fn(() => Promise.resolve()),
  ready: vi.fn(() => Promise.resolve()),
  reloadFeatureFlagsAsync: vi.fn(
    (): Promise<FeatureFlags | undefined> => Promise.resolve(undefined),
  ),
  reset: vi.fn(() => undefined),
}));

vi.mock('posthog-react-native', () => ({
  default: class PostHog {
    capture(name: string, properties?: Record<string, unknown>) {
      posthogSdk.capture(name, properties);
    }

    flush() {
      return posthogSdk.flush();
    }

    optIn() {
      return posthogSdk.optIn();
    }

    optOut() {
      return posthogSdk.optOut();
    }

    ready() {
      return posthogSdk.ready();
    }

    reloadFeatureFlagsAsync() {
      return posthogSdk.reloadFeatureFlagsAsync();
    }

    reset() {
      posthogSdk.reset();
    }
  },
}));
vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    posthogHost: 'https://eu.i.posthog.com',
    posthogProjectApiKey: 'phc_test_project_key',
    productAnalyticsEnabled: true,
  },
}));

import {
  analyticsConsentInternals,
  setAnalyticsConsent,
} from '@/mobile/app/platform/analytics/analyticsConsent';
import {
  initializePostHogAnalytics,
  posthogAnalyticsInternals,
  posthogAnalyticsProvider,
  refreshPostHogRemoteKillSwitches,
} from '@/mobile/app/platform/analytics/posthogAnalyticsProvider';
import {
  isRemoteCapabilityEnabled,
  remoteKillSwitchInternals,
} from '@/mobile/app/platform/analytics/remoteKillSwitches';

describe('posthogAnalyticsProvider privacy filter', () => {
  beforeEach(() => {
    posthogAnalyticsInternals.resetForTests();
    analyticsConsentInternals.resetForTests();
    remoteKillSwitchInternals.resetForTests();
    vi.clearAllMocks();
  });

  it('keeps only typed low-cardinality properties and drops content identifiers', () => {
    expect(posthogAnalyticsInternals.buildSafeProperties({
      name: 'feed_item_impression',
      params: {
        feedItemId: 'private-feed-id',
        listId: 'private-list-id',
        placeId: 'private-place-id',
      },
    })).toEqual({});

    expect(posthogAnalyticsInternals.buildSafeProperties({
      name: 'search_results',
      params: { count: 12, durationMs: 245, kind: 'places', zeroResult: false },
    })).toEqual({ count: 12, durationMs: 245, kind: 'places', zeroResult: false });
  });

  it('rejects SDK-added identifiers, arbitrary values, and non-product events before send', () => {
    expect(posthogAnalyticsInternals.sanitizePostHogEvent({
      event: 'search_results',
      properties: {
        token: 'project-token',
        count: 12,
        distinct_id: 'account-id',
        email: 'private@example.test',
        message: 'private server payload',
      },
    })).toEqual({
      event: 'search_results',
      properties: { token: 'project-token', count: 12 },
    });

    expect(posthogAnalyticsInternals.sanitizePostHogEvent({
      event: '$autocapture',
      properties: { token: 'project-token' },
    })).toBeNull();
  });

  it('fails closed when a foreground feature-flag refresh rejects', async () => {
    posthogSdk.reloadFeatureFlagsAsync.mockResolvedValueOnce({
      sorita_kill_product_analytics: false,
    });
    await setAnalyticsConsent(true);
    await initializePostHogAnalytics();
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(true);

    posthogSdk.reloadFeatureFlagsAsync.mockRejectedValueOnce(
      new Error('distinct_id=private-analytics-id'),
    );
    await expect(refreshPostHogRemoteKillSwitches()).resolves.toBeUndefined();

    expect(posthogSdk.reloadFeatureFlagsAsync).toHaveBeenLastCalledWith();
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);
    posthogAnalyticsProvider.trackEvent({
      name: 'error',
      params: { context: 'private-context', message: 'private-error' },
    });
    expect(posthogSdk.capture).not.toHaveBeenCalled();
  });

  it('fails closed when the SDK returns no flags', async () => {
    posthogSdk.reloadFeatureFlagsAsync.mockResolvedValueOnce({
      sorita_kill_product_analytics: false,
    });
    await setAnalyticsConsent(true);
    await initializePostHogAnalytics();
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(true);

    posthogSdk.reloadFeatureFlagsAsync.mockResolvedValueOnce(undefined);
    await refreshPostHogRemoteKillSwitches();

    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);
  });
});
