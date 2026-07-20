import { beforeEach, describe, expect, it, vi } from 'vitest';

import { androidNotificationChannelId } from '@/mobile/app/platform/notifications/channels';

const ensureAndroidPushChannelMock = vi.fn();
const getPermissionsAsyncMock = vi.fn();
const scheduleNotificationAsyncMock = vi.fn();
const registerDeviceForRemoteMessagesMock = vi.fn();
const getTokenMock = vi.fn();
const subscribeToTopicMock = vi.fn();
const unsubscribeFromTopicMock = vi.fn();
const infoMock = vi.fn();
const warnMock = vi.fn();

const firebaseMessagingMock = vi.fn(() => ({
  getToken: getTokenMock,
  registerDeviceForRemoteMessages: registerDeviceForRemoteMessagesMock,
  subscribeToTopic: subscribeToTopicMock,
  unsubscribeFromTopic: unsubscribeFromTopicMock,
}));

vi.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  getPermissionsAsync: getPermissionsAsyncMock,
  scheduleNotificationAsync: scheduleNotificationAsyncMock,
}));

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  ensureAndroidPushChannel: ensureAndroidPushChannelMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    systemNotificationFcmTopic: 'system-announcements',
  },
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    info: infoMock,
    warn: warnMock,
  },
}));

vi.mock('@/mobile/app/platform/notifications/firebaseMessaging', () => ({
  loadFirebaseMessagingModule: vi.fn(async () => firebaseMessagingMock),
}));

vi.mock('@/mobile/app/platform/notifications/runtime', () => ({
  notificationRuntime: {
    featureEnabled: true,
    isExpoGo: false,
    supportsNotificationObservers: true,
    supportsRemotePushRegistration: true,
  },
}));

describe('systemPushNotificationRepository', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { env } = await import('@/mobile/app/platform/config/env');
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const { Platform } = await import('react-native');

    env.systemNotificationFcmTopic = 'system-announcements';
    notificationRuntime.featureEnabled = true;
    notificationRuntime.isExpoGo = false;
    notificationRuntime.supportsNotificationObservers = true;
    notificationRuntime.supportsRemotePushRegistration = true;
    Platform.OS = 'android';

    getPermissionsAsyncMock.mockResolvedValue({ granted: true, ios: null });
    getTokenMock.mockResolvedValue('fcm-token');
    registerDeviceForRemoteMessagesMock.mockResolvedValue(undefined);
    subscribeToTopicMock.mockResolvedValue(undefined);
    unsubscribeFromTopicMock.mockResolvedValue(undefined);
    scheduleNotificationAsyncMock.mockResolvedValue('notification-id');
  });

  it('subscribes an Android device to the configured system topic', async () => {
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');

    await expect(repository.syncSystemPushNotifications()).resolves.toBe('fcm-token');

    expect(ensureAndroidPushChannelMock).toHaveBeenCalledOnce();
    expect(registerDeviceForRemoteMessagesMock).toHaveBeenCalledOnce();
    expect(subscribeToTopicMock).toHaveBeenCalledWith('system-announcements');
  });

  it('accepts provisional and ephemeral iOS delivery permission', async () => {
    const { Platform } = await import('react-native');
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');
    Platform.OS = 'ios';

    for (const status of [3, 4]) {
      getPermissionsAsyncMock.mockResolvedValueOnce({ granted: false, ios: { status } });
      await expect(repository.syncSystemPushNotifications()).resolves.toBe('fcm-token');
    }

    expect(subscribeToTopicMock).toHaveBeenCalledTimes(2);
  });

  it('skips synchronization for every unsupported runtime state', async () => {
    const { env } = await import('@/mobile/app/platform/config/env');
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');

    notificationRuntime.featureEnabled = false;
    await expect(repository.syncSystemPushNotifications()).resolves.toBeNull();

    notificationRuntime.featureEnabled = true;
    notificationRuntime.isExpoGo = true;
    await expect(repository.syncSystemPushNotifications()).resolves.toBeNull();

    notificationRuntime.isExpoGo = false;
    notificationRuntime.supportsRemotePushRegistration = false;
    await expect(repository.syncSystemPushNotifications()).resolves.toBeNull();

    notificationRuntime.supportsRemotePushRegistration = true;
    env.systemNotificationFcmTopic = '   ';
    await expect(repository.syncSystemPushNotifications()).resolves.toBeNull();

    env.systemNotificationFcmTopic = 'system-announcements';
    getPermissionsAsyncMock.mockResolvedValue({ granted: false, ios: null });
    await expect(repository.syncSystemPushNotifications()).resolves.toBeNull();

    expect(firebaseMessagingMock).not.toHaveBeenCalled();
  });

  it('returns null when Firebase cannot provide a device token', async () => {
    getTokenMock.mockResolvedValue('');
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');

    await expect(repository.syncSystemPushNotifications()).resolves.toBeNull();

    expect(warnMock).toHaveBeenCalledWith('push', 'FCM token could not be resolved.');
    expect(subscribeToTopicMock).not.toHaveBeenCalled();
  });

  it('supports messaging modules without explicit remote registration', async () => {
    firebaseMessagingMock.mockReturnValueOnce({
      getToken: getTokenMock,
      subscribeToTopic: subscribeToTopicMock,
      unsubscribeFromTopic: unsubscribeFromTopicMock,
    } as ReturnType<typeof firebaseMessagingMock>);
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');

    await expect(repository.syncSystemPushNotifications()).resolves.toBe('fcm-token');
    expect(registerDeviceForRemoteMessagesMock).not.toHaveBeenCalled();
  });

  it('unsubscribes only when runtime and topic are available', async () => {
    const { env } = await import('@/mobile/app/platform/config/env');
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');

    notificationRuntime.featureEnabled = false;
    await repository.unregisterSystemPushNotifications();

    notificationRuntime.featureEnabled = true;
    notificationRuntime.isExpoGo = true;
    await repository.unregisterSystemPushNotifications();

    notificationRuntime.isExpoGo = false;
    env.systemNotificationFcmTopic = '';
    await repository.unregisterSystemPushNotifications();

    env.systemNotificationFcmTopic = 'system-announcements';
    await repository.unregisterSystemPushNotifications();

    expect(unsubscribeFromTopicMock).toHaveBeenCalledOnce();
    expect(unsubscribeFromTopicMock).toHaveBeenCalledWith('system-announcements');
  });

  it('presents foreground notifications with safe fallbacks on Android', async () => {
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');

    await repository.presentForegroundSystemPushNotification({
      data: { campaign: 'summer' },
      notification: { body: ' ', title: ' ' },
    });

    expect(scheduleNotificationAsyncMock).toHaveBeenCalledWith({
      content: {
        body: 'Yeni sistem bildirimi',
        data: { campaign: 'summer', source: 'system-fcm' },
        sound: 'default',
        title: 'SoRita',
      },
      trigger: { channelId: androidNotificationChannelId },
    });
  });

  it('uses the remote copy on iOS and skips observers when unsupported', async () => {
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const { Platform } = await import('react-native');
    const repository = await import('@/mobile/app/data/repositories/systemPushNotificationRepository');
    Platform.OS = 'ios';

    await repository.presentForegroundSystemPushNotification({
      data: {},
      notification: { body: 'Body', title: 'Title' },
    });
    expect(scheduleNotificationAsyncMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ body: 'Body', title: 'Title' }),
        trigger: null,
      }),
    );

    notificationRuntime.supportsNotificationObservers = false;
    await repository.presentForegroundSystemPushNotification({ data: {} });
    expect(scheduleNotificationAsyncMock).toHaveBeenCalledTimes(1);
  });
});
