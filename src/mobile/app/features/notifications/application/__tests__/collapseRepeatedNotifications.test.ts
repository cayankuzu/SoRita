import { describe, expect, it } from 'vitest';

import type { MobileNotification } from '@/mobile/app/data/contracts/notification';
import { collapseRepeatedNotifications } from '@/mobile/app/features/notifications/application/collapseRepeatedNotifications';

function notification(
  id: string,
  overrides: Partial<MobileNotification> = {},
): MobileNotification {
  return {
    id,
    type: 'like',
    userName: 'idil',
    userId: 'user-idil',
    message: '"Bottega" mekânını beğendi',
    timestamp: '30.06.2026 14:51',
    read: true,
    linkTo: { type: 'list', listId: 'list-1', placeId: 'place-bottega' },
    ...overrides,
  };
}

describe('collapseRepeatedNotifications', () => {
  it('keeps the newest of a like stored twice', () => {
    const newest = notification('n-2');
    const older = notification('n-1', { timestamp: '30.06.2026 13:08' });

    expect(collapseRepeatedNotifications([newest, older])).toEqual([newest]);
  });

  it('keeps likes of different places, and the same place liked by someone else', () => {
    const items = [
      notification('n-3'),
      notification('n-2', { linkTo: { type: 'list', listId: 'list-1', placeId: 'place-kargart' } }),
      notification('n-1', { userId: 'user-deniz', userName: 'Deniz' }),
    ];

    expect(collapseRepeatedNotifications(items)).toEqual(items);
  });

  it('tells comment likes apart by the comment they quote', () => {
    const items = [
      notification('n-2', { type: 'comment_like', message: 'yorumunu beğendi: "harika"' }),
      notification('n-1', { type: 'comment_like', message: 'yorumunu beğendi: "kediler"' }),
    ];

    expect(collapseRepeatedNotifications(items)).toEqual(items);
  });

  it('never merges comments, replies or requests, which are separate events', () => {
    const items = [
      notification('n-3', { type: 'comment', message: 'yorum yaptı: "güzel"' }),
      notification('n-2', { type: 'comment', message: 'yorum yaptı: "güzel"' }),
      notification('n-1', { type: 'follow_request', linkTo: undefined }),
    ];

    expect(collapseRepeatedNotifications(items)).toEqual(items);
  });
});
