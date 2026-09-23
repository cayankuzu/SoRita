import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Ellipsis: (props: Record<string, unknown>) => React.createElement('Ellipsis', props),
  Heart: (props: Record<string, unknown>) => React.createElement('Heart', props),
  MessageCircle: (props: Record<string, unknown>) => React.createElement('MessageCircle', props),
  Share2: (props: Record<string, unknown>) => React.createElement('Share2', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props),
}));

vi.mock('@/mobile/app/shared/hooks/useHaptic', () => ({
  triggerHaptic: vi.fn(),
}));

import { FeedActionButtons } from '@/mobile/app/features/social/ui/components/FeedActionButtons';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('FeedActionButtons hierarchy', () => {
  it('keeps three primary actions plus overflow and collapses secondary actions', () => {
    const likePromise = Promise.resolve();
    const onLikePress = vi.fn(() => likePromise);
    const onLikersPress = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <FeedActionButtons
          commentCount={0}
          likeCount={3}
          liked={false}
          onCommentPress={vi.fn()}
          onCommentsIntent={vi.fn()}
          onLikePress={onLikePress}
          onLikersPress={onLikersPress}
          onOverflowPress={vi.fn()}
          onSharePress={vi.fn()}
          overflowActionLabel={tr.common.contentActionsTitle}
          showCommentAction
          showComments={false}
          showOverflowAction
          showShareAction
        />,
      );
    });

    const actions = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(actions.map((action) => action.props.accessibilityLabel)).toEqual([
      tr.cards.likeAction,
      `${tr.cards.likedBy}: 3`,
      tr.cards.commentAction,
      tr.cards.share,
      tr.common.contentActionsTitle,
    ]);

    // The glyphs are painted small; the target is the painted box plus hit slop.
    actions.forEach((action) => {
      const style = StyleSheet.flatten(action.props.style);
      const slop = typeof action.props.hitSlop === 'number' ? action.props.hitSlop : 0;
      const width = Number(style.width ?? style.minWidth);
      expect(Number(style.minHeight) + 2 * slop).toBeGreaterThanOrEqual(48);
      expect(width + 2 * slop).toBeGreaterThanOrEqual(48);
    });

    let likeResult: unknown;
    act(() => {
      likeResult = actions[0]?.props.onPress();
    });
    expect(likeResult).toBe(likePromise);
    expect(onLikePress).toHaveBeenCalledOnce();
    expect(onLikersPress).not.toHaveBeenCalled();

    act(() => {
      actions[1]?.props.onPress();
    });
    expect(onLikersPress).toHaveBeenCalledOnce();
  });
});
