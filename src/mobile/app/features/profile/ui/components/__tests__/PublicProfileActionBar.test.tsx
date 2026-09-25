import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Ellipsis: (props: Record<string, unknown>) => React.createElement('Ellipsis', props),
  UserCheck: (props: Record<string, unknown>) => React.createElement('UserCheck', props),
  UserPlus: (props: Record<string, unknown>) => React.createElement('UserPlus', props),
}));

vi.mock('@/mobile/app/shared/components/ui/IconButton', () => ({
  IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props),
}));

vi.mock('@/mobile/app/shared/components/feedback/ConfirmActionModal', () => ({
  ConfirmActionModal: (props: Record<string, unknown>) =>
    React.createElement('ConfirmActionModal', props),
}));


vi.mock('@/mobile/app/shared/components/ui/PrimaryButton', () => ({
  PrimaryButton: (props: Record<string, unknown>) => React.createElement('PrimaryButton', props),
}));

import { PublicProfileActionBar } from '@/mobile/app/features/profile/ui/components/PublicProfileActionBar';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('PublicProfileActionBar', () => {
  it('asks before unfollowing, and says what a private account costs', async () => {
    const onFollowPress = vi.fn().mockResolvedValue(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PublicProfileActionBar
          hasPendingFollowRequest={false}
          isBlockedByCurrent={false}
          isFollowing
          isPrivateAccount
          onFollowPress={onFollowPress}
          onMorePress={vi.fn()}
          onUnblockPress={vi.fn()}
          username="deniz"
        />,
      );
    });

    const followControl = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(followControl.props.accessibilityLabel).toBe(tr.profile.actions.following);
    expect(followControl.props.accessibilityHint).toBe(tr.profile.actions.unfollowHint);

    await act(async () => {
      await followControl.props.onPress();
    });
    expect(onFollowPress).not.toHaveBeenCalled();
    const confirm = renderer.root.find((node) => String(node.type) === 'ConfirmActionModal');
    expect(confirm.props.visible).toBe(true);
    expect(confirm.props.title).toBe('@deniz takibini bırak?');
    expect(confirm.props.description).toBe(tr.profile.actions.unfollowConfirmPrivate);

    await act(async () => {
      await confirm.props.onConfirm();
    });
    expect(onFollowPress).toHaveBeenCalledOnce();
  });

  it('follows in one tap', async () => {
    const onFollowPress = vi.fn().mockResolvedValue(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PublicProfileActionBar
          hasPendingFollowRequest={false}
          isBlockedByCurrent={false}
          isFollowing={false}
          onFollowPress={onFollowPress}
          onMorePress={vi.fn()}
          onUnblockPress={vi.fn()}
          username="deniz"
        />,
      );
    });

    const followControl = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable',
    );
    await act(async () => {
      const result = followControl.props.onPress();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
    expect(onFollowPress).toHaveBeenCalledOnce();
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
          username="deniz"
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
