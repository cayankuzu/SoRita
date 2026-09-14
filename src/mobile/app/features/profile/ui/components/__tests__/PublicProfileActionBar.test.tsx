import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Ellipsis: (props: Record<string, unknown>) => React.createElement('Ellipsis', props),
  UserMinus: (props: Record<string, unknown>) => React.createElement('UserMinus', props),
  UserPlus: (props: Record<string, unknown>) => React.createElement('UserPlus', props),
}));

vi.mock('@/mobile/app/shared/components/ui/IconButton', () => ({
  IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props),
}));

vi.mock('@/mobile/app/shared/components/ui/PrimaryButton', () => ({
  PrimaryButton: (props: Record<string, unknown>) => React.createElement('PrimaryButton', props),
}));

import { PublicProfileActionBar } from '@/mobile/app/features/profile/ui/components/PublicProfileActionBar';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('PublicProfileActionBar', () => {
  it('names the direct unfollow consequence and preserves the async busy contract', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PublicProfileActionBar
          hasPendingFollowRequest={false}
          isBlockedByCurrent={false}
          isFollowing
          onFollowPress={vi.fn().mockResolvedValue(undefined)}
          onMorePress={vi.fn()}
          onUnblockPress={vi.fn()}
        />,
      );
    });

    const followControl = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(followControl.props.accessibilityLabel).toBe(tr.profile.actions.unfollow);
    expect(followControl.props.accessibilityState).toMatchObject({ disabled: false });

    await act(async () => {
      const result = followControl.props.onPress();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  it('makes an already-sent private follow request non-repeatable', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PublicProfileActionBar
          hasPendingFollowRequest
          isBlockedByCurrent={false}
          isFollowing={false}
          onFollowPress={vi.fn().mockResolvedValue(undefined)}
          onMorePress={vi.fn()}
          onUnblockPress={vi.fn()}
        />,
      );
    });

    const followControl = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(followControl.props.accessibilityLabel).toBe(tr.profile.actions.requestSent);
    expect(followControl.props.disabled).toBe(true);
    expect(followControl.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
