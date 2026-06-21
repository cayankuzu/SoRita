import type {
  FollowRequestRow,
  NotificationRow,
  PublicProfileRow,
  UserBlockRow,
} from '@/mobile/app/platform/supabase/databaseTypes';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { formatAbsoluteDateTime } from '@/mobile/app/shared/utils/dateTime';

export type MobileNotification = {
  id: string;
  type:
    | 'like'
    | 'follow'
    | 'follow_request'
    | 'comment'
    | 'place_added'
    | 'place_quote'
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
const HIDDEN_USER_IDS_CACHE_TTL_MS = 1000 * 60;
const hiddenUserIdsCache = new Map<
  string,
  {
    expiresAt: number;
    pending?: Promise<Set<string>>;
    value: Set<string>;
  }
>();

async function getHiddenUserIds(userId: string) {
  const cachedEntry = hiddenUserIdsCache.get(userId);
  const now = Date.now();

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value;
  }

  if (cachedEntry?.pending) {
    return cachedEntry.pending;
  }

  const request = (async () => {
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

    hiddenUserIdsCache.set(userId, {
      expiresAt: Date.now() + HIDDEN_USER_IDS_CACHE_TTL_MS,
      value: hiddenUserIds,
    });

    return hiddenUserIds;
  })().catch((error) => {
    const entry = hiddenUserIdsCache.get(userId);

    if (entry?.pending === request) {
      hiddenUserIdsCache.delete(userId);
    }

    throw error;
  });

  hiddenUserIdsCache.set(userId, {
    expiresAt: 0,
    pending: request,
    value: cachedEntry?.value ?? new Set<string>(),
  });

  return request;
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
  hiddenUserIds: Set<string>,
  actorProfilesById: Map<string, PublicProfileRow>,
) {
  return rows
    .map((row) => mapNotification(row, actorProfilesById))
    .filter((notification) => !notification.userId || !hiddenUserIds.has(notification.userId));
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
  return mapAndFilterNotifications(rows, hiddenUserIds, actorProfilesById);
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
  return mapAndFilterNotifications(rows, hiddenUserIds, actorProfilesById);
}
