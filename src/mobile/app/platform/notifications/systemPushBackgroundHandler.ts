import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { androidNotificationChannelId } from '@/mobile/app/platform/notifications/channels';
import {
  loadFirebaseMessagingModuleSync,
  type FirebaseMessagingRemoteMessage,
} from '@/mobile/app/platform/notifications/firebaseMessaging';
import { t } from '@/mobile/app/shared/i18n';

const BACKGROUND_MESSAGE_IDS_STORAGE_KEY = 'sorita.system-push.background-message-ids.v1';
const MAX_RECENT_BACKGROUND_MESSAGE_IDS = 32;

type BackgroundNotificationDependencies = {
  scheduleMinimalDataNotification: () => Promise<void>;
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
};

type FirebaseMessagingBackgroundModule = {
  getMessaging: () => unknown;
  setBackgroundMessageHandler: (
    messaging: unknown,
    handler: (message: FirebaseMessagingRemoteMessage) => Promise<void>,
  ) => void;
};

type BackgroundHandlerRegistrationDependencies = {
  getFirebaseMessagingModule: () => FirebaseMessagingBackgroundModule;
  handleMessage: (message: FirebaseMessagingRemoteMessage) => Promise<boolean>;
};

let backgroundHandlerRegistered = false;
let backgroundMessageQueue: Promise<void> = Promise.resolve();

function hasControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

function isUsableMessageId(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length >= 1
    && value.length <= 512
    && !hasControlCharacter(value)
  );
}

/**
 * Keep an opaque, bounded marker instead of an FCM payload, token, title, or
 * body. This is deliberately not a cryptographic identifier: it is used only
 * to suppress duplicate local notifications on the same device.
 */
function opaqueMessageMarker(messageId: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < messageId.length; index += 1) {
    hash ^= messageId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function parseRecentMarkers(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed.filter(
      (item): item is string => typeof item === 'string' && /^[a-f0-9]{8}$/u.test(item),
    ).slice(-MAX_RECENT_BACKGROUND_MESSAGE_IDS);
  } catch {
    return [] as string[];
  }
}

function isDataOnlyMessage(message: FirebaseMessagingRemoteMessage) {
  const notification = message.notification;
  return !notification || (!notification.title && !notification.body);
}

async function defaultScheduleMinimalDataNotification() {
  const Notifications = await import('expo-notifications');

  await Notifications.scheduleNotificationAsync({
    content: {
      // Never copy remote data/title/body into the local notification. A data
      // payload can contain user content and must not be persisted or logged by
      // the headless task.
      body: t.notifications.systemPushFallbackBody,
      data: { source: 'system-fcm-data' },
      sound: 'default',
      title: `${t.brand.first}${t.brand.second}`,
    },
    trigger: Platform.OS === 'android' ? { channelId: androidNotificationChannelId } : null,
  });
}

const defaultDependencies: BackgroundNotificationDependencies = {
  scheduleMinimalDataNotification: defaultScheduleMinimalDataNotification,
  storage: AsyncStorage,
};

function loadBackgroundMessagingModule(): FirebaseMessagingBackgroundModule {
  const firebaseMessaging = loadFirebaseMessagingModuleSync();
  const messaging = firebaseMessaging.getMessaging();

  return {
    getMessaging: () => messaging,
    setBackgroundMessageHandler: (_registeredMessaging, handler) => {
      firebaseMessaging.setBackgroundMessageHandler(
        messaging,
        async (message) => handler(message as FirebaseMessagingRemoteMessage),
      );
    },
  };
}

/**
 * Handles only FCM data-only messages delivered while React is backgrounded or
 * terminated. Notification payloads are rendered by the OS and are explicitly
 * ignored here to prevent duplicate banners. The result is intentionally
 * generic; tapping it follows the existing Notifications route.
 */
async function handleSystemPushBackgroundMessageUnlocked(
  message: FirebaseMessagingRemoteMessage,
  dependencies: BackgroundNotificationDependencies = defaultDependencies,
) {
  if (!isDataOnlyMessage(message) || !isUsableMessageId(message.messageId)) {
    return false;
  }

  const marker = opaqueMessageMarker(message.messageId);
  const existingMarkers = parseRecentMarkers(
    await dependencies.storage.getItem(BACKGROUND_MESSAGE_IDS_STORAGE_KEY),
  );

  if (existingMarkers.includes(marker)) {
    return false;
  }

  // Schedule first so a provider/OS failure does not leave a durable marker
  // that permanently suppresses the notification. The module-level queue
  // serializes concurrent deliveries inside the headless JavaScript runtime.
  await dependencies.scheduleMinimalDataNotification();
  await dependencies.storage.setItem(
    BACKGROUND_MESSAGE_IDS_STORAGE_KEY,
    JSON.stringify([...existingMarkers, marker].slice(-MAX_RECENT_BACKGROUND_MESSAGE_IDS)),
  );
  return true;
}

export function handleSystemPushBackgroundMessage(
  message: FirebaseMessagingRemoteMessage,
  dependencies: BackgroundNotificationDependencies = defaultDependencies,
) {
  const result = backgroundMessageQueue.then(
    () => handleSystemPushBackgroundMessageUnlocked(message, dependencies),
    () => handleSystemPushBackgroundMessageUnlocked(message, dependencies),
  );
  backgroundMessageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Registers exactly once per JavaScript runtime. Any handler failure is
 * contained: FCM must be allowed to acknowledge the headless task, and no
 * provider payload or token is emitted to logs.
 */
export function registerSystemPushBackgroundHandler(
  dependencies: BackgroundHandlerRegistrationDependencies = {
    getFirebaseMessagingModule: loadBackgroundMessagingModule,
    handleMessage: handleSystemPushBackgroundMessage,
  },
) {
  if (backgroundHandlerRegistered) {
    return true;
  }

  try {
    const firebaseMessaging = dependencies.getFirebaseMessagingModule();
    const messaging = firebaseMessaging.getMessaging();

    firebaseMessaging.setBackgroundMessageHandler(
      messaging,
      async (message: FirebaseMessagingRemoteMessage) => {
        try {
          await dependencies.handleMessage(message);
        } catch {
          // Do not leak remote payload/error data from a background task.
        }
      },
    );
    backgroundHandlerRegistered = true;
    return true;
  } catch {
    // Expo Go and unsupported test/native environments may not expose the
    // Firebase module. Foreground notification behavior remains unchanged.
    return false;
  }
}

export const systemPushBackgroundHandlerInternals = {
  opaqueMessageMarker,
  parseRecentMarkers,
  resetRegistrationForTests() {
    backgroundHandlerRegistered = false;
    backgroundMessageQueue = Promise.resolve();
  },
};
