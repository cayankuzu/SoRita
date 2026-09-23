import type { MobileNotification } from '@/mobile/app/data/contracts/notification';

// Since the notification dedupe migration a like, list like, comment like or
// follow reaches its recipient once. Rows stored before it can repeat, which
// showed "idil liked Bottega" twice in a row; the list keeps the newest.
const ONCE_ONLY_TYPES = new Set<MobileNotification['type']>([
  'comment_like',
  'follow',
  'like',
  'list_liked',
]);

function repeatKey(notification: MobileNotification) {
  if (!ONCE_ONLY_TYPES.has(notification.type) || !notification.userId) {
    return null;
  }

  const target =
    notification.linkTo?.type === 'list'
      ? `${notification.linkTo.listId}:${notification.linkTo.placeId ?? ''}`
      : '';
  // Two comments on one place share a target; a comment like is told apart
  // by the comment it quotes, as the database does.
  const comment = notification.type === 'comment_like' ? notification.message : '';

  return [notification.type, notification.userId, target, comment].join('|');
}

/** Drops older repeats of the same event from a newest-first list. */
export function collapseRepeatedNotifications(items: MobileNotification[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = repeatKey(item);
    if (key === null) {
      return true;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
