import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  ChevronDown: (props: Record<string, unknown>) => React.createElement('ChevronDown', props),
  ChevronUp: (props: Record<string, unknown>) => React.createElement('ChevronUp', props),
  Heart: (props: Record<string, unknown>) => React.createElement('Heart', props),
  MoreHorizontal: (props: Record<string, unknown>) => React.createElement('MoreHorizontal', props),
  Reply: (props: Record<string, unknown>) => React.createElement('Reply', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AvatarView', () => ({
  AvatarView: (props: Record<string, unknown>) => React.createElement('AvatarView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/ExpandableText', () => ({
  ExpandableText: (props: Record<string, unknown>) => React.createElement('ExpandableText', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('InstantPressable', props, children),
}));

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { CommentThread } from '@/mobile/app/features/social/ui/components/comment-panel/CommentThread';
import { tr } from '@/mobile/app/shared/i18n/tr';

const comment: FeedActionComment = {
  id: 'comment-1',
  userId: 'user-1',
  userName: 'Ada',
  username: 'ada',
  content: 'Harika bir yer.',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  likes: 3,
  liked: false,
};

function renderThread(overrides: Partial<FeedActionComment> = {}) {
  const onShowCommentLikers = vi.fn();
  const onToggleCommentLike = vi.fn(() => Promise.resolve());
  let renderer!: TestRenderer.ReactTestRenderer;
  const renderedComment = { ...comment, ...overrides };

  act(() => {
    renderer = TestRenderer.create(
      <CommentThread
        comment={renderedComment}
        depth={0}
        hiddenReplyCount={0}
        repliesExpanded={false}
        replyCount={0}
        onLoadMoreReplies={vi.fn()}
        onOpenCommentMenu={vi.fn()}
        onShowCommentLikers={onShowCommentLikers}
        onStartReply={vi.fn()}
        onToggleCommentLike={onToggleCommentLike}
        onToggleReplies={vi.fn()}
      />,
    );
  });

  return { onShowCommentLikers, onToggleCommentLike, renderedComment, renderer };
}

describe('CommentThread reaction actions', () => {
  it('separates liking from opening likers into labeled 48dp targets', () => {
    const { onShowCommentLikers, onToggleCommentLike, renderedComment, renderer } = renderThread();
    const actions = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable',
    );
    const likeAction = actions.find(
      (action) => action.props.accessibilityLabel === tr.cards.likeComment,
    );
    const likersAction = actions.find(
      (action) => action.props.accessibilityLabel === `${tr.cards.likedBy}: 3`,
    );

    expect(likeAction).toBeDefined();
    expect(likersAction).toBeDefined();
    expect(likeAction?.props.onLongPress).toBeUndefined();
    expect(likeAction?.props.accessibilityState).toEqual({ selected: false });
    expect(StyleSheet.flatten(likeAction?.props.style)).toMatchObject({ width: 48, height: 48 });
    expect(StyleSheet.flatten(likersAction?.props.style)).toMatchObject({ minWidth: 48, height: 48 });

    let likeResult: unknown;
    act(() => {
      likeResult = likeAction?.props.onPress();
    });
    expect(likeResult).toBeInstanceOf(Promise);
    expect(onToggleCommentLike).toHaveBeenCalledWith('comment-1');
    expect(onShowCommentLikers).not.toHaveBeenCalled();

    act(() => {
      likersAction?.props.onPress();
    });
    expect(onShowCommentLikers).toHaveBeenCalledWith(renderedComment);
    expect(onToggleCommentLike).toHaveBeenCalledOnce();
  });

  it('does not expose a likers action when the count is zero', () => {
    const { renderer } = renderThread({ likes: 0, liked: true });
    const actions = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable',
    );

    expect(actions.some(
      (action) => action.props.accessibilityLabel === `${tr.cards.likedBy}: 0`,
    )).toBe(false);
    expect(actions.find(
      (action) => action.props.accessibilityLabel === tr.cards.unlikeComment,
    )?.props.accessibilityState).toEqual({ selected: true });
  });
});
