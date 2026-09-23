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

  it('keeps replies behind their comment until the thread is opened', () => {
    const rows = flattenVisibleComments(comments, {}, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ moreReplies: null, replyCount: 8, repliesExpanded: false });
    expect(countCommentTree(comments)).toBe(9);
  });

  it('opens a thread a few replies at a time, offering the rest under the last one', () => {
    const opened = flattenVisibleComments(comments, { root: true }, {});
    expect(opened.map((row) => row.comment.id)).toEqual([
      'root',
      'reply-0',
      'reply-1',
      'reply-2',
    ]);
    expect(opened[0]?.moreReplies).toBeNull();
    expect(opened[3]?.moreReplies).toEqual({ count: 5, rootId: 'root' });

    const more = flattenVisibleComments(comments, { root: true }, { root: 6 });
    expect(more).toHaveLength(7);
    expect(more[6]?.moreReplies).toEqual({ count: 2, rootId: 'root' });

    const all = flattenVisibleComments(comments, { root: true }, { root: 9 });
    expect(all).toHaveLength(9);
    expect(all.every((row) => row.moreReplies === null)).toBe(true);
  });
});
