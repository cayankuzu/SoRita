import { supabase } from '@/mobile/app/platform/supabase/client';

import {
  fetchNotifications,
  fetchNotificationsPage,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notifications/notificationQueryHelpers';

export type { MobileNotification } from '@/mobile/app/data/repositories/notifications/notificationQueryHelpers';

export async function refreshNotifications(userId: string): Promise<MobileNotification[]> {
  return fetchNotificationsPage(userId, 0, 20);
}

export async function getNotifications(userId: string): Promise<MobileNotification[]> {
  return fetchNotifications(userId);
}

export async function getNotificationsPage(
  userId: string,
  pageOffset: number,
  pageSize: number,
): Promise<MobileNotification[]> {
  return fetchNotificationsPage(userId, pageOffset, pageSize);
}

export async function getNotificationCount(userId: string): Promise<number> {
  const items = await fetchNotifications(userId);
  return items.filter((item) => !item.read).length;
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
