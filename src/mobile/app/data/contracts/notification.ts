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
