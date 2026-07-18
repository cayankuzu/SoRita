import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

import { env } from '@/mobile/app/platform/config/env';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import {
  getConnectivityStatusFromHttpProbe,
  getConnectivityStatusFromProbeFailure,
  type ConnectionStatus,
} from '@/mobile/app/platform/network/connectivityStatus';
import {
  removeNetInfoSubscription,
  subscribeToNetInfo,
  type NetworkReachabilityState,
} from '@/mobile/app/platform/network/netInfoAdapter';
import { tr } from '@/mobile/app/shared/i18n/tr';

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
 * - Shows user-friendly toast on status change
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const lastToastRef = useRef<ConnectionStatus>('online');

  useEffect(() => {
    let disposed = false;
    let eventDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function updateStatus(nextStatus: ConnectionStatus) {
      if (disposed) {
        return;
      }

      setStatus(nextStatus);
      onlineManager.setOnline(nextStatus !== 'offline');

      if (nextStatus === 'slow' && lastToastRef.current !== 'slow') {
        showToast(tr.system.connectionSlow, 'info');
      }

      if (nextStatus === 'offline' && lastToastRef.current !== 'offline') {
        showToast(tr.system.connectionUnavailable, 'error');
      }

      lastToastRef.current = nextStatus;
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
        if (nextState.isConnected === false || nextState.isInternetReachable === false) {
          updateStatus('offline');
          return;
        }

        if (nextState.isConnected === true || nextState.isInternetReachable === true) {
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
