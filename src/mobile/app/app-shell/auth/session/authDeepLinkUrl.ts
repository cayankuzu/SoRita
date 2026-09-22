import { useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';

export type AuthDeepLinkSnapshot = {
  /** False until the launch URL has been looked up at least once. */
  resolved: boolean;
  url: string | null;
};

const EMPTY: AuthDeepLinkSnapshot = { resolved: false, url: null };

let snapshot: AuthDeepLinkSnapshot = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function publish(next: AuthDeepLinkSnapshot) {
  snapshot = next;

  for (const listener of listeners) {
    listener();
  }
}

/**
 * Capture auth deep links from app start, not from screen mount.
 *
 * A warm launch delivers the link as a `url` event and only then navigates, so
 * a listener registered by the screen is always too late: it never sees the
 * event, and `Linking.getInitialURL()` still reports the original launch
 * intent, which is null. The screen was therefore left with React Navigation's
 * route params, and those carry a deep link's query but never its fragment -
 * which is exactly where Supabase returns the recovery session. The screen then
 * spent its single-use token on a payload that could not contain one.
 *
 * Measured on device: with the state carried only in the fragment, a cold
 * launch reached the token check and a warm launch never saw the link at all.
 */
export function startAuthDeepLinkCapture() {
  if (started) {
    return;
  }

  started = true;

  Linking.addEventListener('url', ({ url }) => {
    publish({ resolved: true, url });
  });

  void Linking.getInitialURL()
    .catch(() => null)
    .then((url) => {
      // A url event is always the newer link, so it wins over the launch URL.
      publish({ resolved: true, url: snapshot.url ?? url });
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getAuthDeepLinkSnapshot() {
  return snapshot;
}

export function useAuthDeepLink(): AuthDeepLinkSnapshot {
  return useSyncExternalStore(subscribe, getAuthDeepLinkSnapshot);
}

/** Test seam: drops the captured link and the subscription guard. */
export function resetAuthDeepLinkCaptureForTests() {
  snapshot = EMPTY;
  started = false;
  listeners.clear();
}
