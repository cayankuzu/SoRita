import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';

export const DEFAULT_VISIBLE_REPLY_COUNT = 3;

/** The rest of a thread, offered under the last reply shown. */
export type MoreRepliesRow = {
  count: number;
  rootId: string;
};

type VisibleCommentRow = {
  comment: FeedActionComment;
  depth: number;
  moreReplies: MoreRepliesRow | null;
  replyCount: number;
  repliesExpanded: boolean;
};

export function countCommentTree(comments: FeedActionComment[]) {
  let count = 0;
  const pending = [...comments];

  while (pending.length > 0) {
    const comment = pending.pop();
    if (!comment) {
      continue;
    }

    count += 1;
    if (comment.replies?.length) {
      pending.push(...comment.replies);
    }
  }

  return count;
}

/**
 * The rows a comment list shows. Replies start hidden behind their comment's
 * "N yanıt" toggle, as on YouTube, and open a few at a time; the button for
 * the next few sits under the last reply shown, where the reader already is.
 */
export function flattenVisibleComments(
  comments: FeedActionComment[],
  expandedReplies: Record<string, boolean>,
  visibleReplyCounts: Record<string, number>,
) {
  const rows: VisibleCommentRow[] = [];

  const appendComment = (comment: FeedActionComment, depth: number) => {
    const replies = comment.replies ?? [];
    const repliesExpanded = expandedReplies[comment.id] ?? false;
    const visibleReplyCount = Math.max(
      DEFAULT_VISIBLE_REPLY_COUNT,
      visibleReplyCounts[comment.id] ?? DEFAULT_VISIBLE_REPLY_COUNT,
    );
    const visibleReplies = repliesExpanded
      ? replies.slice(0, visibleReplyCount)
      : [];

    rows.push({
      comment,
      depth,
      moreReplies: null,
      replyCount: replies.length,
      repliesExpanded,
    });

    visibleReplies.forEach((reply) => appendComment(reply, depth + 1));

    const hiddenReplyCount = replies.length - visibleReplies.length;
    if (visibleReplies.length > 0 && hiddenReplyCount > 0) {
      rows[rows.length - 1].moreReplies = { count: hiddenReplyCount, rootId: comment.id };
    }
  };

  comments.forEach((comment) => appendComment(comment, 0));
  return rows;
}
