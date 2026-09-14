import { beforeEach, describe, expect, it } from 'vitest';

import {
  analyticsConsentInternals,
  hydrateAnalyticsConsent,
  isAnalyticsConsentGranted,
  setAnalyticsConsent,
  shouldClearAnalyticsConsentForAccountBoundary,
} from '@/mobile/app/platform/analytics/analyticsConsent';

describe('analytics consent', () => {
  beforeEach(() => {
    analyticsConsentInternals.resetForTests();
  });

  it('fails closed before a preference is explicitly granted', async () => {
    expect(isAnalyticsConsentGranted()).toBe(false);
    await expect(hydrateAnalyticsConsent()).resolves.toBe(false);
    expect(isAnalyticsConsentGranted()).toBe(false);
  });

  it('persists explicit opt-in and removes it when consent is withdrawn', async () => {
    await expect(setAnalyticsConsent(true)).resolves.toBe(true);
    expect(isAnalyticsConsentGranted()).toBe(true);

    await expect(setAnalyticsConsent(false)).resolves.toBe(false);
    expect(isAnalyticsConsentGranted()).toBe(false);
  });

  it('clears consent at logged-out boots, logout, and direct account switches', () => {
    expect(shouldClearAnalyticsConsentForAccountBoundary(undefined, null)).toBe(true);
    expect(shouldClearAnalyticsConsentForAccountBoundary(undefined, 'account-a')).toBe(false);
    expect(shouldClearAnalyticsConsentForAccountBoundary('account-a', null)).toBe(true);
    expect(shouldClearAnalyticsConsentForAccountBoundary('account-a', 'account-b')).toBe(true);
    expect(shouldClearAnalyticsConsentForAccountBoundary('account-a', 'account-a')).toBe(false);
    expect(shouldClearAnalyticsConsentForAccountBoundary(null, 'account-a')).toBe(false);
  });
});
