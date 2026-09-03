import type {
  MobileNotification,
  VerifiedPushNotificationTarget,
} from '@/mobile/app/data/contracts/notification';

export type { VerifiedPushNotificationTarget } from '@/mobile/app/data/contracts/notification';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const PUSH_NAVIGATION_RETRY_DELAY_MS = 350;
const PUSH_NAVIGATION_MAX_RETRIES = 8;

const notificationTypes = [
  'comment',
  'comment_like',
  'comment_reply',
  'follow',
  'follow_request',
  'like',
  'list_liked',
  'place_added',
  'place_quote',
  'system_announcement',
] as const satisfies readonly MobileNotification['type'][];

export type PushPayload = {
  listId?: string;
  notificationId?: string;
  placeId?: string;
  type?: MobileNotification['type'];
  userId?: string;
};

export type VerifiedPushNavigationTarget =
  | { screen: 'ListDetail'; params: { listId: string; placeId?: string } }
  | { screen: 'Notifications'; params?: undefined }
  | { screen: 'UserProfile'; params: { userId: string } };

function optionalUuid(value: unknown) {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

function optionalNotificationType(value: unknown) {
  return typeof value === 'string'
    && (notificationTypes as readonly string[]).includes(value)
    ? value as MobileNotification['type']
    : undefined;
}

export function normalizePushPayload(data: Record<string, unknown> | undefined): PushPayload {
  return {
    listId: optionalUuid(data?.listId),
    notificationId: optionalUuid(data?.notificationId),
    placeId: optionalUuid(data?.placeId),
    type: optionalNotificationType(data?.type),
    userId: optionalUuid(data?.userId),
  };
}

export function payloadMatchesVerifiedPushNotification(
  payload: PushPayload,
  notification: VerifiedPushNotificationTarget,
) {
  return (
    (!payload.type || payload.type === notification.type)
    && (!payload.userId || payload.userId === notification.actorUserId)
    && (!payload.listId || payload.listId === notification.listId)
    && (!payload.placeId || payload.placeId === notification.placeId)
  );
}

export function resolveVerifiedPushNavigationTarget(
  notification: VerifiedPushNotificationTarget,
): VerifiedPushNavigationTarget {
  if (notification.listId) {
    return {
      params: {
        listId: notification.listId,
        placeId: notification.placeId || undefined,
      },
      screen: 'ListDetail',
    };
  }

  if (notification.actorUserId) {
    return {
      params: { userId: notification.actorUserId },
      screen: 'UserProfile',
    };
  }

  return { screen: 'Notifications' };
}

export type NavigationRetryHandle = {
  cancel: () => void;
};

export function scheduleNavigationWhenReady(params: {
  isReady: () => boolean;
  onExhausted?: () => void;
  onReady: () => void;
  retryDelayMs?: number;
  retryLimit?: number;
}): NavigationRetryHandle {
  const retryDelayMs = params.retryDelayMs ?? PUSH_NAVIGATION_RETRY_DELAY_MS;
  const retryLimit = params.retryLimit ?? PUSH_NAVIGATION_MAX_RETRIES;
  let attempts = 0;
  let cancelled = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    cancelled = true;
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const attemptNavigation = () => {
    if (cancelled) {
      return;
    }

    if (params.isReady()) {
      timeout = null;
      params.onReady();
      return;
    }

    if (attempts >= retryLimit) {
      timeout = null;
      params.onExhausted?.();
      return;
    }

    attempts += 1;
    timeout = setTimeout(attemptNavigation, retryDelayMs);
  };

  attemptNavigation();
  return { cancel };
}

export const pushNavigationInternals = {
  PUSH_NAVIGATION_MAX_RETRIES,
  UUID_PATTERN,
};
