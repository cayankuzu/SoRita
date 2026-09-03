import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState: { booted: boolean; user: { id: string } | null } = {
  booted: true,
  user: null,
};
const flushPendingPushTokenCleanupTombstonesMock = vi.fn();
const prepareRegisteredPushTokenAccountSwitchCleanupMock = vi.fn();
const registerPushNotificationsMock = vi.fn();
const registerDevicePushTokenMock = vi.fn();

vi.mock('@/mobile/app/app-shell/auth/AuthSessionProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  ensureAndroidPushChannel: vi.fn(),
  flushPendingPushTokenCleanupTombstones: flushPendingPushTokenCleanupTombstonesMock,
  prepareRegisteredPushTokenAccountSwitchCleanup: prepareRegisteredPushTokenAccountSwitchCleanupMock,
  registerDevicePushToken: registerDevicePushTokenMock,
  registerPushNotifications: registerPushNotificationsMock,
}));

vi.mock('@/mobile/app/data/repositories/notificationRepository', () => ({
  getNotificationsPage: vi.fn().mockResolvedValue([]),
  getVerifiedPushNotificationTarget: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('@/mobile/app/platform/notifications/runtime', () => ({
  notificationRuntime: {
    featureEnabled: true,
    supportsNotificationObservers: false,
    supportsRemotePushRegistration: true,
  },
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
  };

  return {
    supabase: {
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/mobile/app/data/query/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
}));

vi.mock('@/mobile/app/app-shell/navigation/navigationRef', () => ({
  rootNavigationRef: {
    isReady: () => true,
    navigate: vi.fn(),
  },
}));

vi.mock('expo-notifications', () => ({
  addPushTokenListener: vi.fn(() => ({ remove: vi.fn() })),
}));

describe('PushNotificationsController account switching', () => {
  beforeEach(() => {
    authState.booted = true;
    authState.user = { id: 'account-a' };
    flushPendingPushTokenCleanupTombstonesMock.mockReset();
    prepareRegisteredPushTokenAccountSwitchCleanupMock.mockReset();
    registerPushNotificationsMock.mockReset();
    registerDevicePushTokenMock.mockReset();
    flushPendingPushTokenCleanupTombstonesMock
      .mockResolvedValueOnce({ attempted: 0, pending: 0, revoked: 0 })
      .mockResolvedValueOnce({ attempted: 1, pending: 1, revoked: 0 });
    registerPushNotificationsMock.mockResolvedValue('ExponentPushToken[account-a]');
    prepareRegisteredPushTokenAccountSwitchCleanupMock.mockResolvedValue({
      cleanupSecret: 'a'.repeat(64),
      token: 'ExponentPushToken[account-a]',
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('blocks a second account from binding the device token while the first account tombstone is pending', async () => {
    const { PushNotificationsController } = await import(
      '@/mobile/app/app-shell/notifications/PushNotificationsController'
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<PushNotificationsController />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(registerPushNotificationsMock).toHaveBeenCalledWith('account-a');

    authState.user = { id: 'account-b' };
    await act(async () => {
      renderer.update(<PushNotificationsController />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(prepareRegisteredPushTokenAccountSwitchCleanupMock).toHaveBeenCalledWith(
      'ExponentPushToken[account-a]',
    );
    expect(registerPushNotificationsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });
});
