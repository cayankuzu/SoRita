import type {
  FollowRequestRow,
  NotificationRow,
  PublicProfileRow,
  UserBlockRow,
} from '@/mobile/app/platform/supabase/databaseTypes';
import type {
  MobileNotification,
  NotificationCursor,
  NotificationPage,
} from '@/mobile/app/data/contracts/notification';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { formatAbsoluteDateTime } from '@/mobile/app/shared/utils/dateTime';

export type {
  MobileNotification,
  NotificationCursor,
  NotificationPage,
} from '@/mobile/app/data/contracts/notification';

type NotificationPageRow = {
  actor_name?: string | null;
  actor_profile_photo_url?: string | null;
  actor_user_id?: string | null;
  actor_username?: string | null;
  created_at: string;
  follow_request_id?: string | null;
  follow_request_status?: FollowRequestRow['status'] | null;
  id: string;
  list_id?: string | null;
  list_place_id?: string | null;
  message: string;
  read: boolean;
  recipient_user_id: string;
  type: MobileNotification['type'];
};

type NotificationRecord = NotificationRow & {
  follow_request?: FollowRequestRow[] | FollowRequestRow | null;
};

const NOTIFICATION_SELECT = `
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
  follow_request:follow_requests!notifications_follow_request_id_fkey (
    id,
    requester_id,
    target_user_id,
    status,
    created_at,
    responded_at
  )
`;

async function getHiddenUserIds(userId: string) {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_user_id, blocked_user_id, created_at')
    .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`);

  if (error) {
    throw error;
  }

  const hiddenUserIds = new Set<string>();

  for (const row of ((data || []) as UserBlockRow[])) {
    if (row.blocker_user_id === userId) {
      hiddenUserIds.add(row.blocked_user_id);
    }

    if (row.blocked_user_id === userId) {
      hiddenUserIds.add(row.blocker_user_id);
    }
  }

  return hiddenUserIds;
}

async function fetchActorProfilesById(rows: NotificationRecord[]) {
  const actorUserIds = Array.from(
    new Set(
      rows
        .map((row) => row.actor_user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  if (actorUserIds.length === 0) {
    return new Map<string, PublicProfileRow>();
  }

  const { data, error } = await supabase
    .from('public_profile_summaries')
    .select('id, name, username, is_public_account, bio, profile_photo_url, cover_photo_url, interests, created_at, updated_at')
    .in('id', actorUserIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data || []) as PublicProfileRow[]).map((profile) => [profile.id, profile]),
  );
}

function mapNotification(
  record: NotificationRecord,
  actorProfilesById: Map<string, PublicProfileRow>,
): MobileNotification {
  const actorProfile = record.actor_user_id ? actorProfilesById.get(record.actor_user_id) : undefined;
  const followRequest = Array.isArray(record.follow_request)
    ? record.follow_request[0]
    : record.follow_request;

  return {
    id: record.id,
    type: record.type,
    userName: actorProfile?.name || 'SoRita',
    userPhoto: actorProfile?.profile_photo_url || undefined,
    userId: record.actor_user_id || actorProfile?.id || '',
    message: record.message,
    timestamp: formatAbsoluteDateTime(record.created_at),
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

function mapAndFilterNotifications(
  rows: NotificationRecord[],
  currentUserId: string,
  hiddenUserIds: Set<string>,
  actorProfilesById: Map<string, PublicProfileRow>,
) {
  return rows
    .map((row) => mapNotification(row, actorProfilesById))
    .filter(
      (notification) =>
        (!notification.userId || !hiddenUserIds.has(notification.userId)) &&
        (!notification.userId || notification.userId !== currentUserId),
    );
}

export async function fetchNotifications(userId: string): Promise<MobileNotification[]> {
  const hiddenUserIds = await getHiddenUserIds(userId);
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data || []) as unknown as NotificationRecord[];
  const actorProfilesById = await fetchActorProfilesById(rows);
  return mapAndFilterNotifications(rows, userId, hiddenUserIds, actorProfilesById);
}

export async function fetchNotificationsPage(
  userId: string,
  pageOffset: number,
  pageSize: number,
): Promise<MobileNotification[]> {
  const hiddenUserIds = await getHiddenUserIds(userId);
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .range(pageOffset, pageOffset + pageSize - 1);

  if (error) {
    throw error;
  }

  const rows = (data || []) as unknown as NotificationRecord[];
  const actorProfilesById = await fetchActorProfilesById(rows);
  return mapAndFilterNotifications(rows, userId, hiddenUserIds, actorProfilesById);
}

export async function fetchNotificationsCursorPage(params: {
  cursor?: NotificationCursor | null;
  pageSize: number;
  signal?: AbortSignal;
  userId: string;
}): Promise<NotificationPage> {
  let request = supabase.rpc('notifications_page', {
    p_cursor_created_at: params.cursor?.createdAt ?? null,
    p_cursor_id: params.cursor?.id ?? null,
    p_limit: params.pageSize,
  });

  if (params.signal) {
    request = request.abortSignal(params.signal);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = ((data || []) as unknown) as NotificationPageRow[];
  const items = rows
    .filter((row) => !row.actor_user_id || row.actor_user_id !== params.userId)
    .map<MobileNotification>((row) => ({
      followRequest: row.follow_request_id
        ? {
            id: row.follow_request_id,
            status: row.follow_request_status ?? 'pending',
          }
        : undefined,
      id: row.id,
      linkTo: row.list_id
        ? {
            listId: row.list_id,
            placeId: row.list_place_id || undefined,
            type: 'list',
          }
        : row.actor_user_id
          ? { type: 'profile', userId: row.actor_user_id }
          : undefined,
      message: row.message,
      read: row.read,
      timestamp: formatAbsoluteDateTime(row.created_at),
      type: row.type,
      userId: row.actor_user_id || '',
      userName: row.actor_name || 'SoRita',
      userPhoto: row.actor_profile_photo_url || undefined,
    }));
  const lastRow = rows[rows.length - 1];

  return Object.assign(items, {
    nextCursor:
      rows.length >= params.pageSize && lastRow
        ? { createdAt: lastRow.created_at, id: lastRow.id }
        : undefined,
  });
}
