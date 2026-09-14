import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyRemoteKillSwitchFlags,
  failClosedRemoteKillSwitches,
  isRemoteCapabilityEnabled,
  REMOTE_KILL_SWITCH_TTL_MS,
  remoteKillSwitchInternals,
} from '@/mobile/app/platform/analytics/remoteKillSwitches';

describe('remote kill switches', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    remoteKillSwitchInternals.resetForTests();
  });

  it('fails closed until a valid remote configuration response is applied', () => {
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);
  });

  it('only lets a recognized boolean kill switch disable a shipped capability', () => {
    applyRemoteKillSwitchFlags({ sorita_kill_product_analytics: false });
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(true);

    applyRemoteKillSwitchFlags({ sorita_kill_product_analytics: true });
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);

    applyRemoteKillSwitchFlags({ sorita_kill_product_analytics: 'enabled' });
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);

    applyRemoteKillSwitchFlags({ unshipped_feature: true });
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);
  });

  it('revokes a previously enabled capability when remote state is invalidated', () => {
    applyRemoteKillSwitchFlags({ sorita_kill_product_analytics: false });
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(true);

    failClosedRemoteKillSwitches();
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);
  });

  it('fails closed when a successful remote allow decision reaches its TTL', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    applyRemoteKillSwitchFlags({ sorita_kill_product_analytics: false });
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(true);

    vi.mocked(Date.now).mockReturnValue(now + REMOTE_KILL_SWITCH_TTL_MS);
    expect(isRemoteCapabilityEnabled('productAnalytics')).toBe(false);
  });
});
