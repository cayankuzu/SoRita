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
    | 'comment_reply'
    | 'system_announcement';
  userName: string;
  userPhoto?: string;
  userId: string;
  message: string;
  timestamp: string;
  read: boolean;
  followRequest?: {
    id: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
  linkTo?:
    | { type: 'profile'; userId: string }
    | { type: 'list'; listId: string; placeId?: string };
};

export type NotificationCursor = {
  createdAt: string;
  id: string;
};

export type NotificationPage = MobileNotification[] & {
  nextCursor?: NotificationCursor;
};

/**
 * Minimal recipient-owned notification metadata used to resolve an incoming
 * push tap. It deliberately excludes message text and any provider payload.
 */
export type VerifiedPushNotificationTarget = {
  actorUserId?: string | null;
  id: string;
  listId?: string | null;
  placeId?: string | null;
  recipientUserId: string;
  type: MobileNotification['type'];
};
