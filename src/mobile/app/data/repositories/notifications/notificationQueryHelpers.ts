import type {
  FollowRequestRow,
  NotificationRow,
  ProfileRow,
  UserBlockRow,
} from '@/mobile/app/platform/supabase/databaseTypes';
import { supabase } from '@/mobile/app/platform/supabase/client';

export type MobileNotification = {
  id: string;
  type:
    | 'like'
    | 'follow'
    | 'follow_request'
    | 'comment'
    | 'place_added'
    | 'list_liked'
    | 'comment_like'
    | 'comment_reply';
  userName: string;
  userPhoto?: string;
  userId: string;
  message: string;
  timestamp: string;
  read: boolean;
  followRequest?: {
    id: string;
    status: FollowRequestRow['status'];
  };
  linkTo?:
    | { type: 'profile'; userId: string }
    | { type: 'list'; listId: string; placeId?: string };
};

type NotificationRecord = NotificationRow & {
  actor_profile?: ProfileRow[] | ProfileRow | null;
  follow_request?: FollowRequestRow[] | FollowRequestRow | null;
};

function isMissingFollowRequestsSchemaError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const normalizedMessage = error?.message?.toLowerCase() ?? '';

  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    normalizedMessage.includes('follow_requests') ||
    normalizedMessage.includes('follow_request_id') ||
    normalizedMessage.includes('notifications_follow_request_id_fkey')
  );
}

function isMissingUserBlocksSchemaError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const normalizedMessage = error?.message?.toLowerCase() ?? '';

  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    normalizedMessage.includes('user_blocks')
  );
}

async function getHiddenUserIds(userId: string) {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_user_id, blocked_user_id, created_at');

  if (error && !isMissingUserBlocksSchemaError(error)) {
    throw error;
  }

  const hiddenUserIds = new Set<string>();

  for (const row of ((error ? [] : (data || [])) as UserBlockRow[])) {
    if (row.blocker_user_id === userId) {
      hiddenUserIds.add(row.blocked_user_id);
    }

    if (row.blocked_user_id === userId) {
      hiddenUserIds.add(row.blocker_user_id);
    }
  }

  return hiddenUserIds;
}

function formatRelativeTimestamp(isoDate: string) {
  const now = Date.now();
  const diffMs = Math.max(0, now - new Date(isoDate).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} dk once`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} saat once`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} gun once`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} hafta once`;
}

function mapNotification(record: NotificationRecord): MobileNotification {
  const actorProfile = Array.isArray(record.actor_profile)
    ? record.actor_profile[0]
    : record.actor_profile;
  const followRequest = Array.isArray(record.follow_request)
    ? record.follow_request[0]
    : record.follow_request;

  return {
    id: record.id,
    type: record.type,
    userName: actorProfile?.name || 'SoRita',
    userPhoto: actorProfile?.profile_photo_url || undefined,
    userId: actorProfile?.id || '',
    message: record.message,
    timestamp: formatRelativeTimestamp(record.created_at),
    read: record.read,
    followRequest: followRequest
      ? {
          id: followRequest.id,
          status: followRequest.status,
        }
      : undefined,
    linkTo: record.list_id
      ? {
          type: 'list',
          listId: record.list_id,
          placeId: record.list_place_id || undefined,
        }
      : actorProfile?.id
        ? {
            type: 'profile',
            userId: actorProfile.id,
          }
        : undefined,
  };
}

async function getNotificationsFallbackWithActor(userId: string) {
  return supabase
    .from('notifications')
    .select(
      `
        id,
        recipient_user_id,
        actor_user_id,
        type,
        message,
        list_id,
        list_place_id,
        read,
        created_at,
        actor_profile:profiles!notifications_actor_user_id_fkey (
          id,
          email,
          name,
          username,
          bio,
          profile_photo_url,
          cover_photo_url,
          interests,
          created_at,
          updated_at
        )
      `,
    )
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false });
}

async function getNotificationsFallbackBase(userId: string) {
  return supabase
    .from('notifications')
    .select(
      `
        id,
        recipient_user_id,
        actor_user_id,
        type,
        message,
        list_id,
        list_place_id,
        read,
        created_at
      `,
    )
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false });
}

function mapAndFilterNotifications(rows: NotificationRecord[], hiddenUserIds: Set<string>) {
  return rows
    .map(mapNotification)
    .filter((notification) => !notification.userId || !hiddenUserIds.has(notification.userId));
}

export async function fetchNotifications(userId: string): Promise<MobileNotification[]> {
  const hiddenUserIds = await getHiddenUserIds(userId);
  const { data, error } = await supabase
    .from('notifications')
    .select(
      `
        id,
        recipient_user_id,
        actor_user_id,
        type,
        message,
        list_id,
        list_place_id,
        follow_request_id,
        read,
        created_at,
        actor_profile:profiles!notifications_actor_user_id_fkey (
          id,
          email,
          name,
          username,
          bio,
          profile_photo_url,
          cover_photo_url,
          interests,
          created_at,
          updated_at
        ),
        follow_request:follow_requests!notifications_follow_request_id_fkey (
          id,
          requester_id,
          target_user_id,
          status,
          created_at,
          responded_at
        )
      `,
    )
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false });

  if (error && !isMissingFollowRequestsSchemaError(error)) {
    const { data: fallbackData, error: fallbackError } = await getNotificationsFallbackWithActor(userId);

    if (fallbackError) {
      const { data: baseData, error: baseError } = await getNotificationsFallbackBase(userId);

      if (baseError) {
        throw error;
      }

      return mapAndFilterNotifications((baseData || []) as unknown as NotificationRecord[], hiddenUserIds);
    }

    return mapAndFilterNotifications((fallbackData || []) as unknown as NotificationRecord[], hiddenUserIds);
  }

  if (error) {
    const { data: fallbackData, error: fallbackError } = await getNotificationsFallbackWithActor(userId);

    if (fallbackError) {
      const { data: baseData, error: baseError } = await getNotificationsFallbackBase(userId);

      if (baseError) {
        throw fallbackError;
      }

      return mapAndFilterNotifications((baseData || []) as unknown as NotificationRecord[], hiddenUserIds);
    }

    return mapAndFilterNotifications((fallbackData || []) as unknown as NotificationRecord[], hiddenUserIds);
  }

  return mapAndFilterNotifications((data || []) as unknown as NotificationRecord[], hiddenUserIds);
}
