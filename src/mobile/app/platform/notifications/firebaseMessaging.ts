export type FirebaseMessagingRemoteMessage = {
  data?: Record<string, string | object>;
  messageId?: string | null;
  notification?: {
    body?: string | null;
    title?: string | null;
  } | null;
};

export async function loadFirebaseMessagingModule() {
  return require('@react-native-firebase/messaging') as typeof import('@react-native-firebase/messaging');
}
