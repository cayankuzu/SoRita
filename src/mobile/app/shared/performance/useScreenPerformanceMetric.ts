import { useEffect, useRef } from 'react';

import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';
import { getPerformanceContext } from '@/mobile/app/shared/performance/performanceContext';

type ScreenPerformanceMetricParams = {
  cached?: boolean;
  hasContent: boolean;
  hasError: boolean;
  isLoading: boolean;
  screen: string;
};

export function useScreenPerformanceMetric({
  cached,
  hasContent,
  hasError,
  isLoading,
  screen,
}: ScreenPerformanceMetricParams) {
  const mountedAtRef = useRef(Date.now());
  const trackedRef = useRef(false);

  useEffect(() => {
    if (isLoading || trackedRef.current) {
      return;
    }

    trackedRef.current = true;
    const durationMs = Math.max(0, Date.now() - mountedAtRef.current);
    const networkClass = getCurrentConnectionStatus();
    const performanceContext = getPerformanceContext();
    const terminalState = hasError
      ? hasContent
        ? 'degraded'
        : 'error'
      : hasContent
        ? 'ready'
        : 'empty';
    trackEvent({
      name: 'screen_first_content',
      params: {
        ...performanceContext,
        cached,
        durationMs,
        networkClass,
        screen,
        terminalState,
      },
    });

    return runAfterNextPaint(() => {
      trackEvent({
        name: 'screen_interactive',
        params: {
          ...performanceContext,
          durationMs: Date.now() - mountedAtRef.current,
          networkClass,
          screen,
        },
      });
    });
  }, [cached, hasContent, hasError, isLoading, screen]);
}
