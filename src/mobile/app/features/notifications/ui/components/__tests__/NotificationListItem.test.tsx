import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AvatarView', () => ({
  AvatarView: (props: Record<string, unknown>) => React.createElement('AvatarView', props),
}));

import type { MobileNotification } from '@/mobile/app/features/notifications/application/useNotificationsScreenState';
import { NotificationListItem } from '@/mobile/app/features/notifications/ui/components/NotificationListItem';
import { tr } from '@/mobile/app/shared/i18n/tr';

const followRequest = {
  id: 'notification-1',
  type: 'follow_request',
  read: false,
  message: 'seni takip etmek istiyor',
  timestamp: '1 dk önce',
  userId: 'user-2',
  userName: 'Ada',
  followRequest: { id: 'request-1', status: 'pending' },
} as MobileNotification;

describe('NotificationListItem', () => {
  it('opens the person from the avatar and the content from the rest of the row', () => {
    const onPress = vi.fn();
    const onActorPress = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <NotificationListItem
          notification={{ ...followRequest, type: 'comment' } as MobileNotification}
          onActorPress={onActorPress}
          onPress={onPress}
        />,
      );
    });

    const avatar = renderer.root.find(
      (node) =>
        String(node.type) === 'InstantPressable' &&
        node.props.accessibilityLabel === tr.notifications.openProfile('Ada'),
    );
    avatar.props.onPress();
    expect(onActorPress).toHaveBeenCalledOnce();
    expect(onPress).not.toHaveBeenCalled();

    // Screen readers reach the same shortcut as an action on the row.
    const row = renderer.root.find(
      (node) => String(node.type) === 'InstantPressable' && Boolean(node.props.accessibilityActions),
    );
    row.props.onAccessibilityAction({ nativeEvent: { actionName: 'openProfile' } });
    expect(onActorPress).toHaveBeenCalledTimes(2);
  });

  it('announces complete context and exposes follow decisions as separate controls', () => {
    const onDecision = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <NotificationListItem
          notification={followRequest}
          onPress={vi.fn()}
          onFollowRequestDecision={onDecision}
        />,
      );
    });

    const controls = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(controls.map((control) => control.props.accessibilityLabel)).toEqual([
      `Ada. seni takip etmek istiyor. 1 dk önce. ${tr.notifications.unread}`,
      tr.notifications.reject,
      tr.notifications.accept,
    ]);

    act(() => controls[1]?.props.onPress());
    expect(onDecision).toHaveBeenCalledWith(followRequest, 'reject');
  });

  it('replaces ambiguous decision spinners with one live processing status', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <NotificationListItem
          followRequestPending
          notification={followRequest}
          onPress={vi.fn()}
          onFollowRequestDecision={vi.fn()}
        />,
      );
    });

    const controls = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable',
    );
    expect(controls).toHaveLength(1);
    expect(controls[0]?.props.accessibilityState).toMatchObject({ busy: true });

    const progress = renderer.root.find(
      (node) => node.props.accessibilityRole === 'progressbar',
    );
    expect(progress.props.accessibilityLabel).toBe(tr.notifications.processingRequest);
  });
});
