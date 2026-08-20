import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { User } from '@/mobile/app/data/contracts/entities';
import {
  inferOptimisticFollowResult,
  readOptimisticFollowState,
} from '@/mobile/app/data/query/optimisticFollowState';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

function createUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    username: id,
    blockedByUsers: [],
    blockedUsers: [],
    followers: [],
    following: [],
    pendingFollowRequestsReceived: [],
    pendingFollowRequestsSent: [],
    ...overrides,
  };
}

function createClient(currentUser: User | null, allUsers: User[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.visibleData.context('viewer'), {
    allUsers,
    currentUser,
  });
  return queryClient;
}

describe('optimisticFollowState', () => {
  it('reads following, requested, and unfollowed state from either user source', () => {
    const followingViewer = createUser('viewer', { following: ['target'] });
    const followingClient = createClient(followingViewer, [followingViewer]);
    expect(readOptimisticFollowState(followingClient, {
      currentUserId: 'viewer', targetUserId: 'target',
    })).toBe('following');

    const requestedViewer = createUser('viewer', { pendingFollowRequestsSent: ['target'] });
    const requestedClient = createClient(null, [requestedViewer]);
    expect(readOptimisticFollowState(requestedClient, {
      currentUserId: 'viewer', targetUserId: 'target',
    })).toBe('requested');

    const idleViewer = createUser('viewer');
    const idleClient = createClient(idleViewer, [idleViewer]);
    expect(readOptimisticFollowState(idleClient, {
      currentUserId: 'viewer', targetUserId: 'target',
    })).toBe('unfollowed');
  });

  it('infers toggle results for existing, pending, private, and public relationships', () => {
    const viewer = createUser('viewer', {
      following: ['followed'],
      pendingFollowRequestsSent: ['pending'],
    });
    const queryClient = createClient(null, [
      viewer,
      createUser('followed'),
      createUser('pending'),
      createUser('private', { isPublicAccount: false }),
      createUser('public', { isPublicAccount: true }),
    ]);

    expect(inferOptimisticFollowResult(queryClient, {
      currentUserId: 'viewer', targetUserId: 'followed',
    })).toBe('unfollowed');
    expect(inferOptimisticFollowResult(queryClient, {
      currentUserId: 'viewer', targetUserId: 'pending',
    })).toBe('requested');
    expect(inferOptimisticFollowResult(queryClient, {
      currentUserId: 'viewer', targetUserId: 'private',
    })).toBe('requested');
    expect(inferOptimisticFollowResult(queryClient, {
      currentUserId: 'viewer', targetUserId: 'public',
    })).toBe('following');
  });

  it('ignores malformed caches and falls back safely', () => {
    const queryClient = new QueryClient();
    [null, [], {}, { allUsers: null, currentUser: null }].forEach((value, index) => {
      queryClient.setQueryData([...queryKeys.visibleData.all, `bad-${index}`], value);
    });

    expect(readOptimisticFollowState(queryClient, {
      currentUserId: 'viewer', targetUserId: 'target',
    })).toBeNull();
    expect(inferOptimisticFollowResult(queryClient, {
      currentUserId: 'viewer', targetUserId: 'target',
    })).toBe('following');
  });
});
