import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  AppImage: (props: Record<string, unknown>) => React.createElement('AppImage', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AvatarView', () => ({
  AvatarView: (props: Record<string, unknown>) => React.createElement('AvatarView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/ExpandableText', () => ({
  ExpandableText: (props: Record<string, unknown>) => React.createElement('ExpandableText', props),
}));

vi.mock('@/mobile/app/shared/components/ui/HighlightedText', () => ({
  HighlightedText: (props: Record<string, unknown>) => React.createElement('HighlightedText', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: ({ children, ...props }: {
    children?: React.ReactNode | ((state: { busy: boolean }) => React.ReactNode);
  }) => React.createElement(
    'InstantPressable',
    props,
    typeof children === 'function' ? children({ busy: true }) : children,
  ),
}));

vi.mock('@/mobile/app/shared/hooks/useAppLayout', () => ({
  useAppLayout: () => ({ columnGap: 8, height: 800, width: 390 }),
}));

import { UserGridTile } from '@/mobile/app/features/discovery/ui/components/UserGridTile';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('UserGridTile follow feedback', () => {
  it('exposes the follow action and a live busy state while the request is pending', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <UserGridTile
          user={{
            email: 'ada@example.com',
            id: 'user-1',
            name: 'Ada',
            username: 'ada',
          }}
          isFollowing={false}
          onFollowPress={vi.fn()}
          onPress={vi.fn()}
        />,
      );
    });

    const followButton = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable',
    );
    const profileButton = renderer.root
      .findAllByType('Pressable' as unknown as React.ElementType)
      .find((node) => node.props.accessibilityLabel === 'Ada, @ada');
    expect(followButton.props.accessibilityLabel).toContain('Ada');
    expect(followButton.props.accessibilityRole).toBe('button');

    let parent = followButton.parent;
    let nestedInsideProfileAction = false;
    while (parent) {
      if (parent === profileButton) {
        nestedInsideProfileAction = true;
        break;
      }
      parent = parent.parent;
    }
    expect(nestedInsideProfileAction).toBe(false);

    const liveStatus = renderer.root.find(
      (node) => node.props.accessibilityLiveRegion === 'polite',
    );
    expect(liveStatus.props.children).toBe(tr.common.loading);
  });

  it('disables an already-sent follow request instead of submitting it again', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <UserGridTile
          user={{
            email: 'ada@example.com',
            id: 'user-1',
            name: 'Ada',
            username: 'ada',
          }}
          isFollowing={false}
          isPending
          onFollowPress={vi.fn()}
          onPress={vi.fn()}
        />,
      );
    });

    const followButton = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(followButton.props.accessibilityLabel).toBe(
      `${tr.profile.actions.requestSent}: Ada`,
    );
    expect(followButton.props.disabled).toBe(true);
    expect(followButton.props.accessibilityState).toEqual({
      disabled: true,
      selected: false,
    });
  });

  it('names the consequence of activating an existing follow relationship', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <UserGridTile
          user={{
            email: 'ada@example.com',
            id: 'user-1',
            name: 'Ada',
            username: 'ada',
          }}
          isFollowing
          onFollowPress={vi.fn()}
          onPress={vi.fn()}
        />,
      );
    });

    const followButton = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(followButton.props.accessibilityLabel).toBe(
      `${tr.profile.actions.unfollow}: Ada`,
    );
    expect(followButton.props.disabled).toBe(false);
  });
});
