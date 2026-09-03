export type FirebaseMessagingRemoteMessage = {
  data?: Record<string, string | object>;
  messageId?: string | null;
  notification?: {
    body?: string | null;
    title?: string | null;
  } | null;
};

/**
 * The FCM background handler has to be installed from the JavaScript entrypoint
 * before React is evaluated. Keep this synchronous wrapper separate from the
 * normal lazy import used by UI controllers.
 */
export function loadFirebaseMessagingModuleSync() {
  return require('@react-native-firebase/messaging') as typeof import('@react-native-firebase/messaging');
}

export async function loadFirebaseMessagingModule() {
  return loadFirebaseMessagingModuleSync();
}
