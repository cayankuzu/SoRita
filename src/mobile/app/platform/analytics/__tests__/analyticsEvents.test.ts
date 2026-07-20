import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  registerAnalyticsProvider,
  setAnalyticsUserId,
  setAnalyticsUserProperties,
  trackEvent,
} from '@/mobile/app/platform/analytics/analyticsEvents';

describe('analyticsEvents', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('registers providers idempotently and supports cleanup', () => {
    const provider = {
      setUserId: vi.fn(),
      setUserProperties: vi.fn(),
      trackEvent: vi.fn(),
    };
    cleanups.push(registerAnalyticsProvider(provider));
    cleanups.push(registerAnalyticsProvider(provider));

    trackEvent({ name: 'app_start', params: { cold: true } });
    setAnalyticsUserId('user-1');
    setAnalyticsUserProperties({ locale: 'tr-TR' });

    expect(provider.trackEvent).toHaveBeenCalledTimes(1);
    expect(provider.setUserId).toHaveBeenCalledWith('user-1');
    expect(provider.setUserProperties).toHaveBeenCalledWith({ locale: 'tr-TR' });

    cleanups.shift()?.();
    trackEvent({ name: 'app_start', params: { cold: false } });
    expect(provider.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('isolates provider failures', () => {
    const healthyProvider = {
      setUserId: vi.fn(),
      setUserProperties: vi.fn(),
      trackEvent: vi.fn(),
    };
    cleanups.push(registerAnalyticsProvider({
      setUserId: () => { throw new Error('provider failed'); },
      setUserProperties: () => { throw new Error('provider failed'); },
      trackEvent: () => { throw new Error('provider failed'); },
    }));
    cleanups.push(registerAnalyticsProvider(healthyProvider));

    expect(() => trackEvent({ name: 'offline_entered', params: {} })).not.toThrow();
    expect(healthyProvider.trackEvent).toHaveBeenCalledTimes(1);
  });
});
