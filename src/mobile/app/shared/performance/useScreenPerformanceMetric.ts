import { useEffect, useRef } from 'react';

import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';

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
    const terminalState = hasError
      ? hasContent
        ? 'degraded'
        : 'error'
      : hasContent
        ? 'ready'
        : 'empty';
    trackEvent({
      name: 'screen_first_content',
      params: { cached, durationMs, screen, terminalState },
    });

    return runAfterNextPaint(() => {
      trackEvent({
        name: 'screen_interactive',
        params: { durationMs: Date.now() - mountedAtRef.current, screen },
      });
    });
  }, [cached, hasContent, hasError, isLoading, screen]);
}
