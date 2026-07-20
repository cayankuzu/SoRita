import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  count: vi.fn(),
  distribution: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: sentry.addBreadcrumb,
  metrics: {
    count: sentry.count,
    distribution: sentry.distribution,
  },
  setTag: sentry.setTag,
}));

import { sentryAnalyticsProvider } from '@/mobile/app/platform/analytics/sentryAnalyticsProvider';

describe('sentryAnalyticsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records low-cardinality events, durations and numeric SLO values', () => {
    sentryAnalyticsProvider.trackEvent({
      name: 'search_results',
      params: { count: 12, durationMs: 245, kind: 'places', zeroResult: false },
    });

    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'product',
      data: { kind: 'places', zeroResult: 'false' },
      level: 'info',
      message: 'search_results',
    });
    expect(sentry.count).toHaveBeenCalledWith('sorita.event.search_results', 1, {
      attributes: { kind: 'places', zeroResult: 'false' },
    });
    expect(sentry.distribution).toHaveBeenCalledWith(
      'sorita.duration.search_results',
      245,
      expect.objectContaining({ unit: 'millisecond' }),
    );
    expect(sentry.distribution).toHaveBeenCalledWith(
      'sorita.value.search_results.count',
      12,
      expect.any(Object),
    );
  });

  it('never sends high-cardinality error text as breadcrumb data', () => {
    sentryAnalyticsProvider.trackEvent({
      name: 'error',
      params: { context: 'feed', message: 'private server payload' },
    });

    expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ data: { context: 'feed' }, level: 'error' }),
    );
  });

  it('allows only approved user-property tags and does not duplicate identity', () => {
    sentryAnalyticsProvider.setUserId('user-1');
    sentryAnalyticsProvider.setUserProperties({
      app_version: '1.0.87',
      email: 'private@example.test',
      locale: 'tr-TR',
    });

    expect(sentry.setTag).toHaveBeenCalledWith('app_version', '1.0.87');
    expect(sentry.setTag).toHaveBeenCalledWith('locale', 'tr-TR');
    expect(sentry.setTag).not.toHaveBeenCalledWith('email', expect.anything());
  });
});
