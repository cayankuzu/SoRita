import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

import { env } from '@/mobile/app/platform/config/env';
import {
  getConnectivityStatusFromHttpProbe,
  getConnectivityStatusFromProbeFailure,
  setCurrentConnectionStatus,
  type ConnectionStatus,
} from '@/mobile/app/platform/network/connectivityStatus';
import {
  removeNetInfoSubscription,
  subscribeToNetInfo,
  type NetworkReachabilityState,
} from '@/mobile/app/platform/network/netInfoAdapter';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';

const CONNECTIVITY_CHECK_PATH = '/auth/v1/health';
const CONNECTIVITY_TIMEOUT_MS = 5000;
const CONNECTIVITY_EVENT_DEBOUNCE_MS = 350;

function getConnectivityCheckUrl() {
  const baseUrl = env.supabaseUrl.trim().replace(/\/+$/, '');

  return baseUrl ? `${baseUrl}${CONNECTIVITY_CHECK_PATH}` : null;
}

/**
 * Lightweight connectivity monitor.
 * - Checks on app foreground
 * - Integrates with TanStack Query's onlineManager
 * - Leaves persistent status feedback to OfflineIndicator
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('unknown');
  const previousStatusRef = useRef<ConnectionStatus>('unknown');

  useEffect(() => {
    let disposed = false;
    let eventDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function updateStatus(nextStatus: ConnectionStatus) {
      if (disposed) {
        return;
      }

      setStatus(nextStatus);
      setCurrentConnectionStatus(nextStatus);
      onlineManager.setOnline(nextStatus !== 'offline');

      if (nextStatus === 'offline' && previousStatusRef.current !== 'offline') {
        trackEvent({ name: 'offline_entered', params: { source: 'connectivity-monitor' } });
      }

      previousStatusRef.current = nextStatus;
    }

    async function checkConnectivity() {
      let timeout: ReturnType<typeof setTimeout> | null = null;

      try {
        const connectivityCheckUrl = getConnectivityCheckUrl();

        if (!connectivityCheckUrl) {
          updateStatus('online');
          return;
        }

        const start = Date.now();
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);

        await fetch(connectivityCheckUrl, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });

        const elapsed = Date.now() - start;
        updateStatus(getConnectivityStatusFromHttpProbe(elapsed));
      } catch (error) {
        updateStatus(getConnectivityStatusFromProbeFailure(error));
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    }

    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'active') {
        void checkConnectivity();
      }
    }

    function handleNetInfoChange(nextState: NetworkReachabilityState) {
      if (eventDebounceTimer) {
        clearTimeout(eventDebounceTimer);
      }

      eventDebounceTimer = setTimeout(() => {
        if (
          nextState.isConnected === false ||
          nextState.isInternetReachable === false
        ) {
          updateStatus('offline');
          return;
        }

        if (
          nextState.details?.isConnectionExpensive === true ||
          nextState.details?.cellularGeneration === '2g'
        ) {
          updateStatus('constrained');
          return;
        }

        if (
          nextState.isConnected === true ||
          nextState.isInternetReachable === true
        ) {
          void checkConnectivity();
        }
      }, CONNECTIVITY_EVENT_DEBOUNCE_MS);
    }

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    const netInfoSubscription = subscribeToNetInfo(handleNetInfoChange);

    // Initial check
    void checkConnectivity();

    return () => {
      disposed = true;
      if (eventDebounceTimer) {
        clearTimeout(eventDebounceTimer);
      }
      appStateSubscription.remove();
      removeNetInfoSubscription(netInfoSubscription);
    };
  }, []);

  return status;
}
