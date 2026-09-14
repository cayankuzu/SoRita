import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_CONSENT_STORAGE_KEY = 'sorita.analytics-consent.v1';

let consentGranted = false;
let consentHydrated = false;
let consentMutationSequence = 0;
const listeners = new Set<(granted: boolean) => void>();

function notify() {
  for (const listener of listeners) {
    try {
      listener(consentGranted);
    } catch {
      // Consent observers must never affect the settings screen.
    }
  }
}

/**
 * Analytics is opt-in. A missing, malformed, or unreadable preference is always
 * treated as declined so no provider can start capture before a clear choice.
 */
export async function hydrateAnalyticsConsent() {
  if (consentHydrated) return consentGranted;

  const hydrationSequence = consentMutationSequence;

  try {
    const storedConsent = await AsyncStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (hydrationSequence !== consentMutationSequence) return consentGranted;
    consentGranted = storedConsent === 'granted';
  } catch {
    if (hydrationSequence !== consentMutationSequence) return consentGranted;
    consentGranted = false;
  }

  consentHydrated = true;
  notify();
  return consentGranted;
}

export async function setAnalyticsConsent(granted: boolean) {
  consentMutationSequence += 1;
  consentGranted = granted;
  consentHydrated = true;

  try {
    if (granted) {
      await AsyncStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');
    } else {
      await AsyncStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    }
  } catch {
    // Keep the conservative in-memory preference for this app session.
    if (!granted) consentGranted = false;
  }

  notify();
  return consentGranted;
}

export function isAnalyticsConsentGranted() {
  return consentHydrated && consentGranted;
}

export function shouldClearAnalyticsConsentForAccountBoundary(
  previousUserId: string | null | undefined,
  nextUserId: string | null,
) {
  // A logged-out boot must not inherit a previous account's choice. Once an
  // authenticated identity is known, logout and direct account switches are
  // both privacy boundaries. First restoration of the same persisted session
  // intentionally keeps that account's explicit local choice.
  return (
    (previousUserId === undefined && nextUserId === null) ||
    (typeof previousUserId === 'string' && previousUserId !== nextUserId)
  );
}

export function subscribeToAnalyticsConsent(listener: (granted: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const analyticsConsentInternals = {
  resetForTests() {
    consentGranted = false;
    consentHydrated = false;
    consentMutationSequence = 0;
    listeners.clear();
  },
};
