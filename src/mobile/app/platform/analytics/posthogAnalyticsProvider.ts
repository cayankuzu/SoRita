import PostHog from 'posthog-react-native';
import type { CaptureEvent } from '@posthog/core';

import type { AnalyticsEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import {
  isAnalyticsConsentGranted,
  subscribeToAnalyticsConsent,
} from '@/mobile/app/platform/analytics/analyticsConsent';
import {
  applyRemoteKillSwitchFlags,
  failClosedRemoteKillSwitches,
  isRemoteCapabilityEnabled,
} from '@/mobile/app/platform/analytics/remoteKillSwitches';
import { env } from '@/mobile/app/platform/config/env';

const POSTHOG_EVENT_NAMES = new Set<AnalyticsEvent['name']>([
  'app_start', 'app_foreground', 'screen_view', 'screen_first_shell',
  'screen_first_content', 'screen_interactive', 'tab_switch', 'navigation_complete',
  'query_complete', 'feed_page_loaded', 'feed_item_impression', 'search_started',
  'search_results', 'search_result_opened', 'mutation_started', 'optimistic_applied',
  'mutation_settled', 'upload_started', 'upload_progress_bucket', 'upload_completed',
  'upload_failed', 'upload_paused', 'upload_resumed', 'upload_prepared',
  'upload_prepared_claimed', 'offline_entered', 'outbox_enqueued', 'outbox_synced',
  'media_orphan_cleanup_queued', 'permission_prompted', 'ux_error_shown', 'user_login',
  'user_register', 'content_create', 'content_delete', 'social_action', 'search',
  'media_upload', 'share', 'notification_open', 'error',
]);

const SAFE_STRING_VALUES: Record<string, ReadonlySet<string>> = {
  action: new Set(['like', 'unlike', 'follow', 'unfollow', 'block', 'report']),
  deviceClass: new Set(['high', 'low', 'mid', 'unknown']),
  kind: new Set(['gallery', 'list', 'lists', 'photos', 'place', 'places', 'user', 'users']),
  mediaType: new Set(['photo', 'video']),
  networkClass: new Set(['cellular', 'offline', 'unknown', 'wifi']),
  platform: new Set(['android', 'ios', 'web']),
  result: new Set(['denied', 'granted', 'permanent', 'shown']),
  screen: new Set([
    'Home', 'Map', 'Explore', 'Profile', 'authenticated-shell', 'auth-shell', 'explore',
    'home', 'list-detail', 'map', 'notifications', 'profile', 'user-profile',
  ]),
  source: new Set(['connectivity-monitor', 'stack', 'tab']),
  status: new Set(['error', 'success', 'timeout']),
  tab: new Set(['gallery', 'lists', 'photos', 'places']),
  terminalState: new Set(['degraded', 'empty', 'error', 'ready']),
  type: new Set(['comment', 'list', 'photo', 'place', 'profile', 'video']),
};
const SAFE_BOOLEAN_KEYS = new Set(['cached', 'cold', 'recoverable', 'rollback', 'zeroResult']);
const SAFE_NUMBER_KEYS = new Set([
  'backgroundDurationMs', 'bucket', 'bytesApprox', 'count', 'durationMs', 'jsReadyDurationMs',
  'nativeStartupDurationMs', 'nativeToJavaScriptDurationMs', 'position', 'queryLength',
]);
const MAX_NUMERIC_VALUE = 60 * 60 * 1000;

let posthogClient: PostHog | null = null;
let initializationPromise: Promise<void> | null = null;
let consentListenerStarted = false;
let remoteKillSwitchRefreshSequence = 0;

function canUsePostHog() {
  return Boolean(
    env.productAnalyticsEnabled &&
    env.posthogProjectApiKey &&
    env.posthogHost,
  );
}

function buildSafeProperties(event: AnalyticsEvent) {
  const safeProperties: Record<string, boolean | number | string> = {};

  for (const [key, value] of Object.entries(event.params)) {
    if (SAFE_BOOLEAN_KEYS.has(key) && typeof value === 'boolean') {
      safeProperties[key] = value;
      continue;
    }

    if (SAFE_NUMBER_KEYS.has(key) && typeof value === 'number' && Number.isFinite(value)) {
      safeProperties[key] = Math.max(0, Math.min(Math.round(value), MAX_NUMERIC_VALUE));
      continue;
    }

    if (typeof value === 'string' && SAFE_STRING_VALUES[key]?.has(value)) {
      safeProperties[key] = value;
    }
  }

  return safeProperties;
}

function sanitizePostHogEvent(event: CaptureEvent | null) {
  if (!event || !POSTHOG_EVENT_NAMES.has(event.event as AnalyticsEvent['name'])) {
    return null;
  }

  const token = event.properties?.token;
  if (typeof token !== 'string' || !token) {
    return null;
  }

  const safeProperties = Object.fromEntries(
    Object.entries(event.properties ?? {}).filter(([key, value]) =>
      (SAFE_BOOLEAN_KEYS.has(key) && typeof value === 'boolean') ||
      (SAFE_NUMBER_KEYS.has(key) && typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && SAFE_STRING_VALUES[key]?.has(value)),
    ),
  );

  // Rebuild the object rather than redact in place: SDK/device identifiers,
  // URLs, exception text, user IDs, and arbitrary app values never leave JS.
  return { ...event, properties: { token, ...safeProperties } };
}

function getOrCreateClient() {
  if (!canUsePostHog()) return null;
  if (posthogClient) return posthogClient;

  posthogClient = new PostHog(env.posthogProjectApiKey, {
    host: env.posthogHost,
    defaultOptIn: false,
    // We capture the typed events in analyticsEvents.ts only. Do not add a
    // PostHogProvider, which would enable autocapture/touch collection.
    captureAppLifecycleEvents: false,
    capturePushNotificationOpened: false,
    capturePushNotificationSubscriptions: false,
    disableGeoip: true,
    disableSurveys: true,
    enableSessionReplay: false,
    errorTracking: { autocapture: false, exceptionSteps: { enabled: false } },
    fetchRetryCount: 1,
    fetchRetryDelay: 500,
    featureFlagsRequestMaxRetries: 0,
    featureFlagsRequestTimeoutMs: 3_000,
    flushAt: 10,
    flushInterval: 15_000,
    maxBatchSize: 20,
    maxQueueSize: 50,
    personProfiles: 'never',
    preloadFeatureFlags: false,
    requestTimeout: 3_000,
    sendFeatureFlagEvent: false,
    setDefaultPersonProperties: false,
    before_send: sanitizePostHogEvent,
  });

  return posthogClient;
}

function invalidateRemoteKillSwitchRefresh() {
  remoteKillSwitchRefreshSequence += 1;
  failClosedRemoteKillSwitches();
}

async function refreshRemoteKillSwitches(client: PostHog) {
  const refreshSequence = remoteKillSwitchRefreshSequence + 1;
  remoteKillSwitchRefreshSequence = refreshSequence;
  failClosedRemoteKillSwitches();

  try {
    // The installed SDK types this as Record<string, FeatureFlagValue> | undefined.
    // An undefined result represents an unsuccessful refresh and stays closed.
    const flags = await client.reloadFeatureFlagsAsync();
    if (refreshSequence === remoteKillSwitchRefreshSequence && flags) {
      applyRemoteKillSwitchFlags(flags);
    }
  } catch {
    // The switch was closed before the request. Never log SDK errors here: they
    // can contain request metadata or generated analytics identifiers.
  }
}

export async function refreshPostHogRemoteKillSwitches() {
  const client = posthogClient;
  if (!client || !isAnalyticsConsentGranted()) {
    invalidateRemoteKillSwitchRefresh();
    return;
  }

  await refreshRemoteKillSwitches(client);
}

async function enablePostHogAfterConsent() {
  if (!isAnalyticsConsentGranted()) return;

  const client = getOrCreateClient();
  if (!client) return;

  await client.ready();
  await client.optIn();
  await refreshRemoteKillSwitches(client);
}

async function disablePostHogAfterConsentWithdrawal() {
  invalidateRemoteKillSwitchRefresh();
  if (!posthogClient) return;

  // Opt out before clearing state. A final opt-out after reset handles SDKs
  // whose reset clears the persisted opt-out marker.
  await posthogClient.optOut();
  posthogClient.reset();
  await posthogClient.optOut();
}

export function initializePostHogAnalytics() {
  if (consentListenerStarted) return initializationPromise ?? Promise.resolve();
  consentListenerStarted = true;

  const synchronize = async (granted: boolean) => {
    try {
      if (granted) {
        await enablePostHogAfterConsent();
      } else {
        await disablePostHogAfterConsentWithdrawal();
      }
    } catch {
      // Product analytics must be best effort and cannot delay application startup.
    }
  };

  subscribeToAnalyticsConsent((granted) => {
    void synchronize(granted);
  });
  initializationPromise = synchronize(isAnalyticsConsentGranted());
  return initializationPromise;
}

async function resetPostHogAfterLogout() {
  invalidateRemoteKillSwitchRefresh();
  if (!posthogClient) return;

  try {
    await posthogClient.flush();
  } catch {
    // A failed flush is intentionally ignored; reset still removes local state.
  }

  posthogClient.reset();
  if (isAnalyticsConsentGranted()) {
    try {
      await posthogClient.optIn();
      await refreshRemoteKillSwitches(posthogClient);
    } catch {
      // The next consent refresh/app launch retries bounded SDK requests.
    }
  }
}

export const posthogAnalyticsProvider = {
  trackEvent(event: AnalyticsEvent) {
    if (!isAnalyticsConsentGranted() || !isRemoteCapabilityEnabled('productAnalytics')) {
      return;
    }

    const client = posthogClient;
    if (!client) return;
    client.capture(event.name, buildSafeProperties(event));
  },
  setUserId(userId: string | null) {
    // Never identify a person or send account IDs to PostHog. A logout/account
    // change still clears the anonymous SDK queue, feature flags, and IDs.
    if (userId == null) void resetPostHogAfterLogout();
  },
  setUserProperties(_properties: Record<string, string>) {
    // Intentionally unsupported: product analytics has no person properties.
  },
};

export const posthogAnalyticsInternals = {
  buildSafeProperties,
  sanitizePostHogEvent,
  resetForTests() {
    invalidateRemoteKillSwitchRefresh();
    posthogClient = null;
    initializationPromise = null;
    consentListenerStarted = false;
    remoteKillSwitchRefreshSequence = 0;
  },
};
