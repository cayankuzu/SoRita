import type { MobileNotification } from '@/mobile/app/data/contracts/notification';

export type NotificationTarget =
  | {
      screen: 'ListDetail';
      params: { listId: string; placeId?: string };
    }
  | {
      screen: 'UserProfile';
      params: { userId: string };
    };

export function resolveNotificationTarget(
  notification: MobileNotification,
): NotificationTarget | null {
  if (notification.linkTo?.type === 'profile' && notification.linkTo.userId) {
    return {
      screen: 'UserProfile',
      params: { userId: notification.linkTo.userId },
    };
  }

  if (notification.linkTo?.type === 'list' && notification.linkTo.listId) {
    return {
      screen: 'ListDetail',
      params: {
        listId: notification.linkTo.listId,
        placeId: notification.linkTo.placeId,
      },
    };
  }

  switch (notification.type) {
    case 'follow':
    case 'follow_request':
    case 'like':
    case 'comment':
    case 'place_added':
    case 'place_quote':
    case 'list_liked':
    case 'comment_like':
    case 'comment_reply':
      return notification.userId
        ? { screen: 'UserProfile', params: { userId: notification.userId } }
        : null;
    case 'system_announcement':
      return null;
  }
}
