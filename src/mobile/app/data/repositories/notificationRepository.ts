import { supabase } from '@/mobile/app/platform/supabase/client';

import {
  fetchNotifications,
  fetchNotificationsCursorPage,
  type MobileNotification,
  type NotificationCursor,
  type NotificationPage,
} from '@/mobile/app/data/repositories/notifications/notificationQueryHelpers';
import type { VerifiedPushNotificationTarget } from '@/mobile/app/data/contracts/notification';

export type {
  MobileNotification,
  NotificationCursor,
  NotificationPage,
} from '@/mobile/app/data/repositories/notifications/notificationQueryHelpers';

export async function refreshNotifications(userId: string): Promise<MobileNotification[]> {
  return fetchNotificationsCursorPage({ pageSize: 20, userId });
}

export async function getNotifications(userId: string): Promise<MobileNotification[]> {
  return fetchNotifications(userId);
}

export async function getNotificationsPage(
  userId: string,
  pageOffset: number,
  pageSize: number,
): Promise<MobileNotification[]> {
  if (pageOffset === 0) {
    return fetchNotificationsCursorPage({ pageSize, userId });
  }

  const collected: MobileNotification[] = [];
  let cursor: NotificationCursor | undefined;

  while (collected.length < pageOffset + pageSize) {
    const page = await fetchNotificationsCursorPage({
      cursor,
      pageSize: Math.min(50, pageOffset + pageSize - collected.length),
      userId,
    });
    collected.push(...page);

    if (!page.nextCursor) {
      break;
    }

    cursor = page.nextCursor;
  }

  return collected.slice(pageOffset, pageOffset + pageSize);
}

export function getNotificationsCursorPage(params: {
  cursor?: NotificationCursor | null;
  pageSize: number;
  signal?: AbortSignal;
  userId: string;
}): Promise<NotificationPage> {
  return fetchNotificationsCursorPage(params);
}

export async function getNotificationCount(_userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('notification_unread_count');

  if (!error && typeof data === 'number') {
    return data;
  }

  if (!error && typeof data === 'string') {
    const parsed = Number(data);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (error) {
    throw error;
  }

  throw new Error('Notification count response was invalid.');
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    throw error;
  }
}

/**
 * Resolve a push target from the recipient-owned row, rather than routing from
 * an untrusted provider payload. The select is intentionally metadata-only.
 */
export async function getVerifiedPushNotificationTarget(
  notificationId: string,
  recipientUserId: string,
): Promise<VerifiedPushNotificationTarget | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, recipient_user_id, actor_user_id, type, list_id, list_place_id')
    .eq('id', notificationId)
    .eq('recipient_user_id', recipientUserId)
    .limit(1);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;

  if (
    !row
    || typeof row.id !== 'string'
    || typeof row.recipient_user_id !== 'string'
    || row.recipient_user_id !== recipientUserId
    || typeof row.type !== 'string'
  ) {
    return null;
  }

  const type = row.type as VerifiedPushNotificationTarget['type'];
  const knownTypes: readonly string[] = [
    'comment', 'comment_like', 'comment_reply', 'follow', 'follow_request',
    'like', 'list_liked', 'place_added', 'place_quote', 'system_announcement',
  ];

  if (!knownTypes.includes(type)) {
    return null;
  }

  return {
    actorUserId: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
    id: row.id,
    listId: typeof row.list_id === 'string' ? row.list_id : null,
    placeId: typeof row.list_place_id === 'string' ? row.list_place_id : null,
    recipientUserId: row.recipient_user_id,
    type,
  };
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_user_id', userId)
    .eq('read', false);

  if (error) {
    throw error;
  }
}

export async function createPlaceQuoteNotification(params: {
  actorUserId: string;
  listId?: string | null;
  message: string;
  placeId?: string | null;
  recipientUserId: string;
}) {
  if (!params.recipientUserId || !params.actorUserId || params.recipientUserId === params.actorUserId) {
    return;
  }

  const { error } = await supabase.rpc('create_place_quote_notification', {
    input_list_id: params.listId || null,
    input_list_place_id: params.placeId || null,
    input_message: params.message,
    input_recipient_user_id: params.recipientUserId,
  });

  if (error) {
    throw error;
  }
}

export async function respondToFollowRequestNotification(
  notificationId: string,
  requestId: string,
  decision: 'accept' | 'reject',
) {
  const { error: requestError } = await supabase.rpc('respond_to_follow_request', {
    input_request_id: requestId,
    input_decision: decision,
  });

  if (requestError) {
    throw requestError;
  }

  await markNotificationRead(notificationId);
}
