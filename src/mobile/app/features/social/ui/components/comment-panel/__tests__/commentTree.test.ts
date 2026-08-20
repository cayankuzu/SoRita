import { describe, expect, it } from 'vitest';

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import {
  countCommentTree,
  flattenVisibleComments,
} from '@/mobile/app/features/social/ui/components/comment-panel/commentTree';

function comment(id: string, replies: FeedActionComment[] = []): FeedActionComment {
  return {
    id,
    userId: `user-${id}`,
    userName: id,
    content: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    replies,
  };
}

describe('commentTree', () => {
  const replies = Array.from({ length: 8 }, (_, index) => comment(`reply-${index}`));
  const comments = [comment('root', replies)];

  it('flattens only a progressive reply window into list rows', () => {
    const initial = flattenVisibleComments(comments, {}, {});
    expect(initial.map((row) => row.comment.id)).toEqual([
      'root',
      'reply-0',
      'reply-1',
      'reply-2',
    ]);
    expect(initial[0]?.hiddenReplyCount).toBe(5);

    const expanded = flattenVisibleComments(comments, {}, { root: 6 });
    expect(expanded).toHaveLength(7);
    expect(expanded[0]?.hiddenReplyCount).toBe(2);
  });

  it('collapses replies without changing the total comment count', () => {
    const rows = flattenVisibleComments(comments, { root: false }, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hiddenReplyCount).toBe(8);
    expect(countCommentTree(comments)).toBe(9);
  });
});
