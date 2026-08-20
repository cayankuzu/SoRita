import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';

export const DEFAULT_VISIBLE_REPLY_COUNT = 3;

export type VisibleCommentRow = {
  comment: FeedActionComment;
  depth: number;
  hiddenReplyCount: number;
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

export function flattenVisibleComments(
  comments: FeedActionComment[],
  expandedReplies: Record<string, boolean>,
  visibleReplyCounts: Record<string, number>,
) {
  const rows: VisibleCommentRow[] = [];

  const appendComment = (comment: FeedActionComment, depth: number) => {
    const replies = comment.replies ?? [];
    const repliesExpanded = expandedReplies[comment.id] ?? true;
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
      hiddenReplyCount: repliesExpanded
        ? Math.max(0, replies.length - visibleReplies.length)
        : replies.length,
      replyCount: replies.length,
      repliesExpanded,
    });

    visibleReplies.forEach((reply) => appendComment(reply, depth + 1));
  };

  comments.forEach((comment) => appendComment(comment, 0));
  return rows;
}
