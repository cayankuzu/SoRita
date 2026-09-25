import type { FeatureFlagValue } from '@posthog/core';

export type RemoteKillSwitch = 'productAnalytics';

const remoteKillSwitchFlagKeys: Record<RemoteKillSwitch, string> = {
  productAnalytics: 'sorita_kill_product_analytics',
};

type KillSwitchState = Record<RemoteKillSwitch, boolean>;

export const REMOTE_KILL_SWITCH_TTL_MS = 5 * 60 * 1000;

// A remote response must be successfully received before a capability can run.
// This fail-closed initial state means a malformed response or unavailable
// network can never remotely enable a new or unsafe capability.
let remoteConfigReady = false;
let remoteConfigExpiresAt = 0;
let activeKillSwitches: KillSwitchState = { productAnalytics: true };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Configuration listeners must never affect app execution.
    }
  }
}

export function applyRemoteKillSwitchFlags(flags: Record<string, FeatureFlagValue>) {
  const analyticsKillSwitch = flags[remoteKillSwitchFlagKeys.productAnalytics];
  activeKillSwitches = {
    // The remote response must explicitly return a boolean `false` before
    // capture can run. String variants, omitted flags, and unknown keys stay
    // fail-closed and can never enable a capability.
    productAnalytics: analyticsKillSwitch !== false,
  };
  remoteConfigReady = true;
  remoteConfigExpiresAt = Date.now() + REMOTE_KILL_SWITCH_TTL_MS;
  notify();
}

/**
 * Invalidates previously fetched flags before a refresh and after any failed
 * refresh. A stale allow response must never keep analytics capture enabled.
 */
export function failClosedRemoteKillSwitches() {
  remoteConfigReady = false;
  remoteConfigExpiresAt = 0;
  activeKillSwitches = { productAnalytics: true };
  notify();
}

export function isRemoteCapabilityEnabled(capability: RemoteKillSwitch) {
  return remoteConfigReady && Date.now() < remoteConfigExpiresAt && !activeKillSwitches[capability];
}

export const remoteKillSwitchInternals = {
  resetForTests() {
    remoteConfigReady = false;
    remoteConfigExpiresAt = 0;
    activeKillSwitches = { productAnalytics: true };
    listeners.clear();
  },
};
