import { describe, expect, it } from 'vitest';

import { buildUsers, mapList } from '@/mobile/app/data/mappers/visibleDataMappers';
import type {
  FollowRequestRow,
  FollowRow,
  ProfileRow,
  UserBlockRow,
} from '@/mobile/app/platform/supabase/databaseTypes';

describe('visibleDataMappers', () => {
  it('builds users with relationship metadata', () => {
    const profiles: ProfileRow[] = [
      {
        id: 'viewer',
        email: 'viewer@example.com',
        name: 'Viewer',
        username: 'viewer',
        is_public_account: true,
        bio: 'bio',
        profile_photo_url: 'https://cdn.example.com/profile.jpg',
        cover_photo_url: 'https://cdn.example.com/cover.jpg',
        interests: ['coffee'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'target',
        email: 'target@example.com',
        name: 'Target',
        username: 'target',
        is_public_account: false,
        bio: null,
        profile_photo_url: null,
        cover_photo_url: null,
        interests: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ];
    const follows: FollowRow[] = [
      { follower_id: 'viewer', following_id: 'target', created_at: '2025-01-01T00:00:00.000Z' },
    ];
    const followRequests: FollowRequestRow[] = [
      {
        id: 'request-1',
        requester_id: 'target',
        target_user_id: 'viewer',
        status: 'pending',
        created_at: '2025-01-01T00:00:00.000Z',
        responded_at: null,
      },
    ];
    const blockRows: UserBlockRow[] = [
      { blocker_user_id: 'viewer', blocked_user_id: 'blocked', created_at: '2025-01-01T00:00:00.000Z' },
    ];

    const users = buildUsers(profiles, follows, followRequests, blockRows);

    expect(users[0]).toMatchObject({
      id: 'viewer',
      following: ['target'],
      pendingFollowRequestsReceived: ['target'],
      blockedUsers: ['blocked'],
      profilePhoto: 'https://cdn.example.com/profile.jpg',
    });
    expect(users[1]).toMatchObject({
      id: 'target',
      followers: ['viewer'],
      isPublicAccount: false,
    });
  });

  it('maps a list with nested places, likes, comments, and media', () => {
    const usersById = new Map([
      ['viewer', { id: 'viewer', email: 'viewer@example.com', name: 'Viewer', username: 'viewer', profilePhoto: 'avatar.jpg' }],
      ['target', { id: 'target', email: 'target@example.com', name: 'Target', username: 'target' }],
    ]);

    const list = mapList(
      {
        id: 'list-1',
        owner_id: 'viewer',
        name: 'Favorites',
        description: 'best places',
        emoji: '⭐',
        cover_image_url: ' https://cdn.example.com/cover.jpg ',
        is_public: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-02T00:00:00.000Z',
        list_likes: [
          { list_id: 'list-1', user_id: 'target', created_at: '2025-01-03T00:00:00.000Z' },
        ],
        list_places: [
          {
            id: 'place-1',
            list_id: 'list-1',
            created_by: 'viewer',
            source_list_id: null,
            source_place_id: null,
            source_place_name: null,
            source_user_avatar_url: null,
            source_user_id: null,
            source_user_name: null,
            name: 'Cafe',
            title: 'Brunch',
            lat: 1,
            lng: 2,
            address: 'Address',
            notes: 'Notes',
            rating: 4,
            category: 'coffee',
            categories: ['coffee'],
            student_discount: true,
            price_range: 2,
            price_min: 100,
            price_max: 200,
            best_time: 'morning',
            best_times: ['morning'],
            atmosphere: ['cozy'],
            special_features: ['WiFi'],
            added_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-02T00:00:00.000Z',
            list_place_likes: [
              { list_place_id: 'place-1', user_id: 'target', created_at: '2025-01-04T00:00:00.000Z' },
            ],
            list_place_comments: [
              {
                id: 'comment-1',
                list_place_id: 'place-1',
                user_id: 'target',
                parent_comment_id: null,
                content: 'hello',
                created_at: '2025-01-03T00:00:00.000Z',
                updated_at: '2025-01-03T00:00:00.000Z',
                list_place_comment_likes: [
                  { comment_id: 'comment-1', user_id: 'viewer', created_at: '2025-01-04T00:00:00.000Z' },
                ],
              },
              {
                id: 'reply-1',
                list_place_id: 'place-1',
                user_id: 'viewer',
                parent_comment_id: 'comment-1',
                content: 'reply',
                created_at: '2025-01-04T00:00:00.000Z',
                updated_at: '2025-01-04T00:00:00.000Z',
                list_place_comment_likes: [],
              },
            ],
            list_place_photos: [
              {
                id: 'photo-1',
                list_place_id: 'place-1',
                url: 'https://cdn.example.com/photo.jpg',
                media_type: 'photo',
                mime_type: 'image/jpeg',
                duration_ms: null,
                thumbnail_url: null,
                width: null,
                height: null,
                sort_order: 0,
                created_at: '2025-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
      usersById as never,
    );

    expect(list).toMatchObject({
      id: 'list-1',
      userId: 'viewer',
      coverImage: 'https://cdn.example.com/cover.jpg',
      likes: 1,
      likedBy: ['target'],
    });
    expect(list.places[0]).toMatchObject({
      id: 'place-1',
      likes: 1,
      likedBy: ['target'],
      photos: ['https://cdn.example.com/photo.jpg'],
      addedBy: {
        userId: 'viewer',
        userName: 'Viewer',
        userAvatar: 'avatar.jpg',
      },
    });
    expect(list.places[0]?.comments?.[0]).toMatchObject({
      id: 'comment-1',
      replies: [{ id: 'reply-1' }],
    });
    expect(list.places[0]?.comments?.[0]?.author).toMatchObject({
      userId: 'target',
      name: 'Target',
    });
  });

  it('handles sparse rows, pending sent requests, and orphaned comment relationships', () => {
    const profiles: ProfileRow[] = [
      {
        id: 'viewer',
        email: 'viewer@example.com',
        name: 'Viewer',
        username: 'viewer',
        is_public_account: true,
        bio: null,
        profile_photo_url: 'file:///tmp/profile.jpg',
        cover_photo_url: 'file:///tmp/cover.jpg',
        interests: [],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'blocked',
        email: 'blocked@example.com',
        name: 'Blocked',
        username: 'blocked',
        is_public_account: true,
        bio: null,
        profile_photo_url: null,
        cover_photo_url: null,
        interests: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ];
    const follows: FollowRow[] = [];
    const followRequests: FollowRequestRow[] = [
      {
        id: 'request-1',
        requester_id: 'viewer',
        target_user_id: 'blocked',
        status: 'pending',
        created_at: '2025-01-01T00:00:00.000Z',
        responded_at: null,
      },
      {
        id: 'request-2',
        requester_id: 'viewer',
        target_user_id: 'blocked',
        status: 'accepted',
        created_at: '2025-01-01T00:00:00.000Z',
        responded_at: '2025-01-02T00:00:00.000Z',
      },
    ];
    const blockRows: UserBlockRow[] = [
      { blocker_user_id: 'other', blocked_user_id: 'viewer', created_at: '2025-01-01T00:00:00.000Z' },
      { blocker_user_id: 'viewer', blocked_user_id: 'blocked', created_at: '2025-01-01T00:00:00.000Z' },
      { blocker_user_id: 'viewer', blocked_user_id: 'blocked', created_at: '2025-01-02T00:00:00.000Z' },
    ];

    const users = buildUsers(profiles, follows, followRequests, blockRows);

    expect(users[0]).toMatchObject({
      id: 'viewer',
      pendingFollowRequestsSent: ['blocked'],
      blockedByUsers: ['other'],
      blockedUsers: ['blocked'],
      profilePhoto: undefined,
      coverPhoto: undefined,
      interests: undefined,
    });
    expect(users[1]).toMatchObject({
      id: 'blocked',
      pendingFollowRequestsReceived: ['viewer'],
    });

    const list = mapList(
      {
        id: 'list-2',
        owner_id: 'viewer',
        name: 'Sparse',
        description: null,
        emoji: null,
        cover_image_url: 'file:///tmp/cover.jpg',
        is_public: false,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-02T00:00:00.000Z',
        list_likes: null,
        list_places: [
          {
            id: 'place-2',
            list_id: 'list-2',
            created_by: null,
            source_list_id: null,
            source_place_id: null,
            source_place_name: null,
            source_user_avatar_url: null,
            source_user_id: null,
            source_user_name: null,
            name: 'Library',
            title: null,
            lat: 1,
            lng: 2,
            address: null,
            notes: null,
            rating: null,
            category: null,
            categories: null,
            student_discount: false,
            price_range: null,
            price_min: null,
            price_max: null,
            best_time: null,
            best_times: null,
            atmosphere: null,
            special_features: null,
            added_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-02T00:00:00.000Z',
            list_place_likes: null,
            list_place_comments: [
              {
                id: 'orphan-reply',
                list_place_id: 'place-2',
                user_id: 'missing-user',
                parent_comment_id: 'missing-parent',
                content: 'reply',
                created_at: '2025-01-02T00:00:00.000Z',
                updated_at: '2025-01-02T00:00:00.000Z',
                list_place_comment_likes: null,
              },
            ],
            list_place_photos: null,
          },
        ],
      },
      new Map(users.map((item) => [item.id, item])) as never,
    );

    expect(list).toMatchObject({
      id: 'list-2',
      coverImage: 'file:///tmp/cover.jpg',
      likedBy: undefined,
    });
    expect(list.places[0]).toMatchObject({
      id: 'place-2',
      title: undefined,
      address: undefined,
      categories: undefined,
      photos: [],
      addedBy: undefined,
    });
    expect(list.places[0]?.comments).toHaveLength(1);
    expect(list.places[0]?.comments?.[0]).toMatchObject({
      id: 'orphan-reply',
      author: undefined,
      likedBy: undefined,
      replies: [],
    });
  });
});
