import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  pushNotificationsEnabledOverride: null as boolean | null,
}));

const deviceMock = vi.hoisted(() => ({
  isDevice: false,
}));

const constantsMock = vi.hoisted(() => ({
  appOwnership: 'standalone' as string | null,
}));

vi.mock('expo-constants', () => ({
  default: constantsMock,
}));

vi.mock('expo-device', () => deviceMock);

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: envMock,
}));

describe('notificationRuntime', () => {
  beforeEach(() => {
    vi.resetModules();
    envMock.pushNotificationsEnabledOverride = null;
    deviceMock.isDevice = false;
    constantsMock.appOwnership = 'standalone';
  });

  it('keeps local notification observers enabled by default outside Expo Go', async () => {
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');

    expect(notificationRuntime.featureEnabled).toBe(true);
    expect(notificationRuntime.supportsNotificationObservers).toBe(true);
    expect(notificationRuntime.supportsRemotePushRegistration).toBe(false);
  });

  it('disables notifications entirely in Expo Go unless explicitly overridden', async () => {
    constantsMock.appOwnership = 'expo';

    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');

    expect(notificationRuntime.featureEnabled).toBe(false);
    expect(notificationRuntime.supportsNotificationObservers).toBe(false);
    expect(notificationRuntime.supportsRemotePushRegistration).toBe(false);
  });

  it('respects an explicit disable override', async () => {
    envMock.pushNotificationsEnabledOverride = false;
    deviceMock.isDevice = true;

    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');

    expect(notificationRuntime.featureEnabled).toBe(false);
    expect(notificationRuntime.supportsNotificationObservers).toBe(false);
    expect(notificationRuntime.supportsRemotePushRegistration).toBe(false);
  });

  it('allows remote push registration on physical devices', async () => {
    deviceMock.isDevice = true;

    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');

    expect(notificationRuntime.featureEnabled).toBe(true);
    expect(notificationRuntime.supportsNotificationObservers).toBe(true);
    expect(notificationRuntime.supportsRemotePushRegistration).toBe(true);
  });
});
