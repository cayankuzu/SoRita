import { logger } from '@/mobile/app/platform/feedback/logger';
import type { PerformanceContext } from '@/mobile/app/shared/performance/performanceContext';

type PartialPerformanceContext = Partial<PerformanceContext>;

export type AnalyticsEvent =
  | {
      name: 'app_start';
      params: {
        cold: boolean;
        deviceClass?: string;
        jsReadyDurationMs?: number;
        nativeStartupDurationMs?: number;
        nativeToJavaScriptDurationMs?: number;
        networkClass?: string;
      } & PartialPerformanceContext;
    }
  | { name: 'app_foreground'; params: { backgroundDurationMs: number } }
  | { name: 'screen_view'; params: { cached?: boolean; screen: string; source?: string } }
  | { name: 'screen_first_shell'; params: { durationMs: number; screen: string } }
  | {
      name: 'screen_first_content';
      params: {
        cached?: boolean;
        durationMs: number;
        networkClass?: string;
        screen: string;
        terminalState?: 'degraded' | 'empty' | 'error' | 'ready';
      } & PartialPerformanceContext;
    }
  | {
      name: 'screen_interactive';
      params: {
        durationMs: number;
        networkClass?: string;
        screen: string;
      } & PartialPerformanceContext;
    }
  | { name: 'tab_switch'; params: { durationMs: number; screen: string } & PartialPerformanceContext }
  | {
      name: 'navigation_complete';
      params: {
        durationMs: number;
        screen: string;
        source: 'stack' | 'tab';
      } & PartialPerformanceContext;
    }
  | {
      name: 'query_complete';
      params: {
        bytesApprox?: number;
        cacheHit?: boolean;
        durationMs: number;
        networkClass?: string;
        operation: string;
        status: 'error' | 'success' | 'timeout';
      } & PartialPerformanceContext;
    }
  | { name: 'feed_page_loaded'; params: { cached?: boolean; count: number; durationMs?: number } }
  | { name: 'feed_item_impression'; params: { feedItemId: string; listId?: string; placeId?: string } }
  | { name: 'search_started'; params: { kind?: string; queryLength: number } }
  | { name: 'search_results'; params: { count: number; durationMs: number; kind?: string; zeroResult: boolean } }
  | { name: 'search_result_opened'; params: { kind: string; position?: number } }
  | { name: 'mutation_started'; params: { operation: string } }
  | { name: 'optimistic_applied'; params: { operation: string } }
  | { name: 'mutation_settled'; params: { operation: string; rollback?: boolean; status: 'error' | 'success' } }
  | {
      name: 'upload_started' | 'upload_progress_bucket' | 'upload_completed' | 'upload_failed' | 'upload_paused' | 'upload_resumed' | 'upload_prepared' | 'upload_prepared_claimed';
      params: { bucket?: number; mediaType?: 'photo' | 'video'; operationId?: string };
    }
  | { name: 'offline_entered'; params: { source?: string } }
  | { name: 'outbox_enqueued'; params: { operation: string } }
  | { name: 'outbox_synced'; params: { count: number; status: 'error' | 'success' } }
  | { name: 'media_orphan_cleanup_queued'; params: { bucket: string; count: number } }
  | { name: 'permission_prompted'; params: { permission: string; result: 'denied' | 'granted' | 'permanent' | 'shown' } }
  | { name: 'ux_error_shown'; params: { context: string; recoverable?: boolean } }
  | { name: 'user_login'; params: { method: string } }
  | { name: 'user_register'; params: { method: string } }
  | { name: 'content_create'; params: { type: 'place' | 'list' | 'comment' } }
  | { name: 'content_delete'; params: { type: 'place' | 'list' | 'comment' } }
  | { name: 'social_action'; params: { action: 'like' | 'unlike' | 'follow' | 'unfollow' | 'block' | 'report' } }
  | { name: 'search'; params: { queryLength: number; tab: string } }
  | { name: 'media_upload'; params: { type: 'photo' | 'video'; count: number } }
  | { name: 'share'; params: { type: 'place' | 'list' | 'profile' } }
  | { name: 'notification_open'; params: { type: string } }
  | { name: 'error'; params: { context: string; message: string } };

type AnalyticsProvider = {
  trackEvent: (event: AnalyticsEvent) => void;
  setUserId: (userId: string | null) => void;
  setUserProperties: (properties: Record<string, string>) => void;
};

const providers: AnalyticsProvider[] = [];

export function registerAnalyticsProvider(provider: AnalyticsProvider) {
  if (!providers.includes(provider)) {
    providers.push(provider);
  }

  return () => {
    const index = providers.indexOf(provider);

    if (index >= 0) {
      providers.splice(index, 1);
    }
  };
}

export function trackEvent(event: AnalyticsEvent) {
  logger.debug('analytics', `${event.name}`, event.params);

  for (const provider of providers) {
    try {
      provider.trackEvent(event);
    } catch {
      // Analytics failures should never crash the app
    }
  }
}

export function setAnalyticsUserId(userId: string | null) {
  for (const provider of providers) {
    try {
      provider.setUserId(userId);
    } catch {
      // Analytics failures should never crash the app
    }
  }
}

export function setAnalyticsUserProperties(properties: Record<string, string>) {
  for (const provider of providers) {
    try {
      provider.setUserProperties(properties);
    } catch {
      // Analytics failures should never crash the app
    }
  }
}
