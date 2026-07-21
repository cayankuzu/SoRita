import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';
import { getPerformanceContext } from '@/mobile/app/shared/performance/performanceContext';

type PendingNavigation = {
  source: 'stack' | 'tab';
  startedAt: number;
};

const pendingNavigations = new Map<string, PendingNavigation>();
let lastVisibleRouteKey: string | null = null;

export function markNavigationStarted(
  screen: string,
  source: PendingNavigation['source'],
) {
  pendingNavigations.set(screen, { source, startedAt: Date.now() });
}

export function markScreenVisible(screen: string, routeKey: string) {
  if (lastVisibleRouteKey === routeKey) {
    return;
  }

  lastVisibleRouteKey = routeKey;
  const pending = pendingNavigations.get(screen);
  trackEvent({
    name: 'screen_view',
    params: { screen, source: pending?.source },
  });

  if (!pending) {
    return;
  }

  pendingNavigations.delete(screen);
  runAfterNextPaint(() => {
    trackEvent({
      name: 'navigation_complete',
      params: {
        ...getPerformanceContext(),
        durationMs: Math.max(0, Date.now() - pending.startedAt),
        screen,
        source: pending.source,
      },
    });
  });
}

export const navigationPerformanceInternals = {
  pendingNavigations,
  reset() {
    lastVisibleRouteKey = null;
    pendingNavigations.clear();
  },
};
