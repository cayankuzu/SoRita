import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  normalizePushPayload,
  payloadMatchesVerifiedPushNotification,
  pushNavigationInternals,
  resolveVerifiedPushNavigationTarget,
  scheduleNavigationWhenReady,
} from '@/mobile/app/app-shell/notifications/pushNavigation';

const notification = {
  actorUserId: '22222222-2222-4222-8222-222222222222',
  id: '11111111-1111-4111-8111-111111111111',
  listId: '33333333-3333-4333-8333-333333333333',
  placeId: '44444444-4444-4444-8444-444444444444',
  recipientUserId: '55555555-5555-4555-8555-555555555555',
  type: 'comment' as const,
};

afterEach(() => {
  vi.useRealTimers();
});

describe('push navigation verification', () => {
  it('drops malformed provider fields and accepts only the existing route contract', () => {
    expect(normalizePushPayload({
      listId: 'not-a-uuid',
      notificationId: notification.id,
      placeId: 9,
      type: 'new-notification-kind',
      userId: 'not-a-uuid',
    })).toEqual({ notificationId: notification.id });
  });

  it('uses recipient-owned metadata rather than raw provider route fields', () => {
    const payload = normalizePushPayload({
      listId: notification.listId,
      notificationId: notification.id,
      placeId: notification.placeId,
      type: notification.type,
      userId: notification.actorUserId,
    });

    expect(payloadMatchesVerifiedPushNotification(payload, notification)).toBe(true);
    expect(payloadMatchesVerifiedPushNotification({
      ...payload,
      userId: '66666666-6666-4666-8666-666666666666',
    }, notification)).toBe(false);
    expect(resolveVerifiedPushNavigationTarget(notification)).toEqual({
      params: {
        listId: notification.listId,
        placeId: notification.placeId,
      },
      screen: 'ListDetail',
    });
  });

  it('bounds navigation readiness retries instead of recursively scheduling forever', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const onExhausted = vi.fn();

    scheduleNavigationWhenReady({
      isReady: () => false,
      onExhausted,
      onReady,
      retryDelayMs: 1,
    });
    vi.runAllTimers();

    expect(onReady).not.toHaveBeenCalled();
    expect(onExhausted).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(pushNavigationInternals.PUSH_NAVIGATION_MAX_RETRIES).toBe(8);
  });

  it('cancels a pending route attempt when the controller unmounts or its user changes', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const onExhausted = vi.fn();
    const handle = scheduleNavigationWhenReady({
      isReady: () => false,
      onExhausted,
      onReady,
      retryDelayMs: 1,
    });

    handle.cancel();
    vi.runAllTimers();

    expect(onReady).not.toHaveBeenCalled();
    expect(onExhausted).not.toHaveBeenCalled();
  });
});
