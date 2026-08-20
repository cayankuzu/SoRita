import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Send: (props: Record<string, unknown>) => React.createElement('Send', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AvatarView', () => ({
  AvatarView: (props: Record<string, unknown>) =>
    React.createElement('AvatarView', props),
}));

describe('CommentComposer', () => {
  const onCommentTextChange = vi.fn();
  const onSubmit = vi.fn();

  beforeEach(() => {
    onCommentTextChange.mockReset();
    onSubmit.mockReset();
  });

  it('exposes accessible quick reactions and keeps send disabled for empty copy', async () => {
    const { CommentComposer } = await import('../CommentComposer');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <CommentComposer
          commentText=""
          composerInset={10}
          onCancelEdit={vi.fn()}
          onCancelReply={vi.fn()}
          onCommentTextChange={onCommentTextChange}
          onSubmit={onSubmit}
        />,
      );
    });

    const reactionButton = renderer.root
      .findAllByType('Pressable' as unknown as React.ElementType)
      .find((item) => item.props.accessibilityLabel?.includes('❤️'));
    const sendButton = renderer.root
      .findAllByType('Pressable' as unknown as React.ElementType)
      .find((item) => item.props.accessibilityLabel === 'Gönder');

    expect(reactionButton).toBeDefined();
    expect(reactionButton?.props.accessibilityRole).toBe('button');
    expect(sendButton?.props.disabled).toBe(true);

    act(() => {
      reactionButton?.props.onPress();
    });

    expect(onCommentTextChange).toHaveBeenCalledWith('❤️');
  });
});
