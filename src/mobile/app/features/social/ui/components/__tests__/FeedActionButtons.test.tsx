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
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <FeedActionButtons
          commentCount={0}
          likeCount={0}
          liked={false}
          onCommentPress={vi.fn()}
          onCommentsIntent={vi.fn()}
          onLikePress={vi.fn()}
          onLikersPress={vi.fn()}
          onOverflowPress={vi.fn()}
          onSharePress={vi.fn()}
          overflowActionLabel={tr.profile.actions.menuTitle}
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
      tr.cards.commentAction,
      tr.cards.share,
      tr.profile.actions.menuTitle,
    ]);

    actions.forEach((action) => {
      const style = StyleSheet.flatten(action.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    });
  });
});
