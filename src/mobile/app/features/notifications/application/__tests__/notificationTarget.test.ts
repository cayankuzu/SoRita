import { describe, expect, it } from 'vitest';

import type { MobileNotification } from '@/mobile/app/data/contracts/notification';
import { resolveNotificationTarget } from '@/mobile/app/features/notifications/application/notificationTarget';

function notification(
  overrides: Partial<MobileNotification>,
): MobileNotification {
  return {
    id: 'notification-1',
    message: 'message',
    read: false,
    timestamp: 'now',
    type: 'like',
    userId: 'actor-1',
    userName: 'Ada',
    ...overrides,
  };
}

describe('resolveNotificationTarget', () => {
  it('uses explicit list and profile targets', () => {
    expect(
      resolveNotificationTarget(
        notification({
          linkTo: { type: 'list', listId: 'list-1', placeId: 'place-1' },
        }),
      ),
    ).toEqual({
      screen: 'ListDetail',
      params: { listId: 'list-1', placeId: 'place-1' },
    });

    expect(
      resolveNotificationTarget(
        notification({ linkTo: { type: 'profile', userId: 'profile-1' } }),
      ),
    ).toEqual({ screen: 'UserProfile', params: { userId: 'profile-1' } });
  });

  it('never routes actorless announcements or malformed actor fallbacks', () => {
    expect(
      resolveNotificationTarget(
        notification({ type: 'system_announcement', userId: '' }),
      ),
    ).toBeNull();
    expect(resolveNotificationTarget(notification({ userId: '' }))).toBeNull();
  });

  it.each<MobileNotification['type']>([
    'like',
    'follow',
    'follow_request',
    'comment',
    'place_added',
    'place_quote',
    'list_liked',
    'comment_like',
    'comment_reply',
  ])('routes %s notifications to the actor profile when no explicit target exists', (type) => {
    expect(resolveNotificationTarget(notification({ type }))).toEqual({
      screen: 'UserProfile',
      params: { userId: 'actor-1' },
    });
  });

  it('falls back safely when an external payload contains an incomplete explicit target', () => {
    expect(
      resolveNotificationTarget(
        notification({
          linkTo: { type: 'profile' } as MobileNotification['linkTo'],
        }),
      ),
    ).toEqual({ screen: 'UserProfile', params: { userId: 'actor-1' } });
    expect(
      resolveNotificationTarget(
        notification({
          linkTo: { type: 'list' } as MobileNotification['linkTo'],
        }),
      ),
    ).toEqual({ screen: 'UserProfile', params: { userId: 'actor-1' } });
  });
});
