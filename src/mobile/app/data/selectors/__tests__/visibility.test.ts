import { describe, expect, it } from 'vitest';

import {
  getBlockStateForUsers,
  getHiddenUserIdsFor,
  getVisibleListsFor,
  getVisibleUsersFor,
} from '@/mobile/app/data/selectors/visibility';
import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { UserBlockRow } from '@/mobile/app/platform/supabase/databaseTypes';

const viewer: User = {
  id: 'viewer',
  email: 'viewer@example.com',
  name: 'Viewer',
  username: 'viewer',
};

const hiddenUser: User = {
  id: 'hidden',
  email: 'hidden@example.com',
  name: 'Hidden',
  username: 'hidden',
};

const publicUser: User = {
  id: 'public',
  email: 'public@example.com',
  name: 'Public',
  username: 'public',
};

const blockRows: UserBlockRow[] = [
  {
    blocker_user_id: 'viewer',
    blocked_user_id: 'hidden',
    created_at: '2025-01-01T00:00:00.000Z',
  },
];

const lists: PlaceList[] = [
  {
    id: 'list-visible',
    userId: 'public',
    name: 'Visible',
    places: [
      {
        id: 'place-visible',
        name: 'Cafe',
        lat: 1,
        lng: 2,
        likedBy: ['viewer', 'hidden'],
        likeDetails: [
          { userId: 'viewer', createdAt: '2025-01-01T00:00:00.000Z' },
          { userId: 'hidden', createdAt: '2025-01-01T00:00:00.000Z' },
        ],
        comments: [
          {
            id: 'comment-1',
            userId: 'public',
            content: 'hello',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            likedBy: ['hidden', 'viewer'],
            likeDetails: [
              { userId: 'hidden', createdAt: '2025-01-01T00:00:00.000Z' },
              { userId: 'viewer', createdAt: '2025-01-01T00:00:00.000Z' },
            ],
            replies: [
              {
                id: 'reply-1',
                userId: 'hidden',
                content: 'blocked reply',
                createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
        addedAt: '2025-01-01T00:00:00.000Z',
        addedBy: {
          userId: 'public',
          userName: 'Public',
        },
      },
    ],
    isPublic: true,
    likedBy: ['viewer', 'hidden'],
    likeDetails: [
      { userId: 'viewer', createdAt: '2025-01-01T00:00:00.000Z' },
      { userId: 'hidden', createdAt: '2025-01-01T00:00:00.000Z' },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'list-hidden',
    userId: 'hidden',
    name: 'Hidden list',
    places: [],
    isPublic: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

describe('visibility selectors', () => {
  it('builds hidden ids for the viewer', () => {
    expect(Array.from(getHiddenUserIdsFor(blockRows, 'viewer'))).toEqual(['hidden']);
    expect(Array.from(getHiddenUserIdsFor(blockRows, null))).toEqual([]);
  });

  it('returns block state between two users', () => {
    expect(getBlockStateForUsers(blockRows, 'viewer', 'hidden')).toEqual({
      blockedByCurrent: true,
      blockedByTarget: false,
    });
  });

  it('filters hidden users out of visible users', () => {
    const visibleUsers = getVisibleUsersFor([viewer, hiddenUser, publicUser], blockRows, 'viewer');
    expect(visibleUsers.map((item) => item.id)).toEqual(['viewer', 'public']);
  });

  it('sanitizes likes, comments, and blocked owners from visible lists', () => {
    const [visibleList] = getVisibleListsFor(lists, blockRows, 'viewer');

    expect(getVisibleListsFor(lists, blockRows, 'viewer')).toHaveLength(1);
    expect(visibleList.id).toBe('list-visible');
    expect(visibleList.likes).toBe(1);
    expect(visibleList.likedBy).toEqual(['viewer']);
    expect(visibleList.places[0]?.likes).toBe(1);
    expect(visibleList.places[0]?.comments?.[0]?.likes).toBe(1);
    expect(visibleList.places[0]?.comments?.[0]?.replies).toBeUndefined();
  });
});
