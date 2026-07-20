import * as Sentry from '@sentry/react-native';

import type { AnalyticsEvent } from '@/mobile/app/platform/analytics/analyticsEvents';

const LOW_CARDINALITY_KEYS = new Set([
  'action',
  'bucket',
  'cached',
  'cold',
  'context',
  'kind',
  'mediaType',
  'method',
  'operation',
  'permission',
  'recoverable',
  'result',
  'rollback',
  'screen',
  'source',
  'status',
  'tab',
  'type',
  'zeroResult',
]);

function readDurationMs(event: AnalyticsEvent) {
  return 'durationMs' in event.params && typeof event.params.durationMs === 'number'
    ? event.params.durationMs
    : null;
}

function buildMetricAttributes(event: AnalyticsEvent) {
  return Object.fromEntries(
    Object.entries(event.params)
      .filter(([key, value]) => LOW_CARDINALITY_KEYS.has(key) && ['boolean', 'string'].includes(typeof value))
      .map(([key, value]) => [key, String(value).slice(0, 64)]),
  );
}

function readNumericMetrics(event: AnalyticsEvent) {
  return Object.entries(event.params).filter(
    ([key, value]) => ['bucket', 'bytesApprox', 'count'].includes(key) &&
      typeof value === 'number' &&
      Number.isFinite(value),
  ) as Array<[string, number]>;
}

export const sentryAnalyticsProvider = {
  trackEvent(event: AnalyticsEvent) {
    const attributes = buildMetricAttributes(event);
    const durationMs = readDurationMs(event);

    Sentry.addBreadcrumb({
      category: 'product',
      data: attributes,
      level: event.name === 'error' ? 'error' : 'info',
      message: event.name,
    });
    Sentry.metrics.count(`sorita.event.${event.name}`, 1, { attributes });

    if (durationMs != null && Number.isFinite(durationMs)) {
      Sentry.metrics.distribution(`sorita.duration.${event.name}`, durationMs, {
        attributes,
        unit: 'millisecond',
      });
    }

    for (const [key, value] of readNumericMetrics(event)) {
      Sentry.metrics.distribution(`sorita.value.${event.name}.${key}`, value, {
        attributes,
      });
    }
  },
  setUserId(_userId: string | null) {
    // Identity is managed once by AuthProvider; analytics never duplicates PII.
  },
  setUserProperties(properties: Record<string, string>) {
    for (const [key, value] of Object.entries(properties)) {
      if (/^(account_type|app_version|locale|platform)$/.test(key)) {
        Sentry.setTag(key, value.slice(0, 64));
      }
    }
  },
};
