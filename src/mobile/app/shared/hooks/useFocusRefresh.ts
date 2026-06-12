import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { usePullToRefresh } from '@/mobile/app/shared/hooks/usePullToRefresh';

type UseFocusRefreshOptions = {
  minFocusIntervalMs?: number;
  skipInitialFocus?: boolean;
};

const DEFAULT_FOCUS_REFRESH_INTERVAL_MS = 1000 * 45;

export function useFocusRefresh(
  action: () => void | Promise<void>,
  options: UseFocusRefreshOptions = {},
) {
  const inFlightRef = useRef<Promise<void> | null>(null);
  const hasFocusedOnceRef = useRef(false);
  const lastFocusRefreshAtRef = useRef(0);
  const minFocusIntervalMs = options.minFocusIntervalMs ?? DEFAULT_FOCUS_REFRESH_INTERVAL_MS;
  const skipInitialFocus = options.skipInitialFocus ?? false;

  const runRefresh = useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const refreshPromise = Promise.resolve(action())
      .catch((error) => {
        logger.error('focus-refresh', 'Refresh action failed', error);
      })
      .finally(() => {
        if (inFlightRef.current === refreshPromise) {
          inFlightRef.current = null;
        }
      });

    inFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [action]);

  useFocusEffect(
    useCallback(() => {
      if (skipInitialFocus && !hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }

      const now = Date.now();
      if (now - lastFocusRefreshAtRef.current < minFocusIntervalMs) {
        return;
      }

      lastFocusRefreshAtRef.current = now;
      void runRefresh();
    }, [minFocusIntervalMs, runRefresh, skipInitialFocus]),
  );

  return usePullToRefresh(runRefresh);
}
