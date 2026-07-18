export type FirebaseMessagingRemoteMessage = {
  data: Record<string, string>;
  messageId?: string | null;
  notification?: {
    body?: string | null;
    title?: string | null;
  } | null;
};

export async function loadFirebaseMessagingModule() {
  const module = require('@react-native-firebase/messaging');
  return module.default;
}
