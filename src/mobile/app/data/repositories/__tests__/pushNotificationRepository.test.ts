import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  androidNotificationChannelId,
  androidNotificationChannelName,
} from '@/mobile/app/platform/notifications/channels';

const getPermissionsAsyncMock = vi.fn();
const requestPermissionsAsyncMock = vi.fn();
const getExpoPushTokenAsyncMock = vi.fn();
const setNotificationChannelAsyncMock = vi.fn();
const rpcMock = vi.fn();
const infoMock = vi.fn();
const warnMock = vi.fn();

vi.mock('expo-notifications', () => ({
  AndroidAudioContentType: {
    SONIFICATION: 'sonification',
  },
  AndroidAudioUsage: {
    NOTIFICATION_COMMUNICATION_INSTANT: 'notification_communication_instant',
  },
  AndroidImportance: {
    MAX: 'max',
  },
  AndroidNotificationVisibility: {
    PUBLIC: 1,
  },
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  getExpoPushTokenAsync: getExpoPushTokenAsyncMock,
  getPermissionsAsync: getPermissionsAsyncMock,
  requestPermissionsAsync: requestPermissionsAsyncMock,
  setNotificationChannelAsync: setNotificationChannelAsyncMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    expoProjectId: 'project-id',
    pushNotificationsEnabledOverride: true,
  },
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    info: infoMock,
    warn: warnMock,
  },
}));

vi.mock('@/mobile/app/platform/notifications/runtime', () => ({
  notificationRuntime: {
    featureEnabled: true,
    isExpoGo: false,
    supportsRemotePushRegistration: true,
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('pushNotificationRepository', () => {
  beforeEach(async () => {
    getPermissionsAsyncMock.mockReset();
    requestPermissionsAsyncMock.mockReset();
    getExpoPushTokenAsyncMock.mockReset();
    setNotificationChannelAsyncMock.mockReset();
    rpcMock.mockReset();
    infoMock.mockReset();
    warnMock.mockReset();

    const { env } = await import('@/mobile/app/platform/config/env');
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const { Platform } = await import('react-native');

    env.expoProjectId = 'project-id';
    env.pushNotificationsEnabledOverride = true;
    notificationRuntime.isExpoGo = false;
    notificationRuntime.featureEnabled = true;
    notificationRuntime.supportsRemotePushRegistration = true;
    Platform.OS = 'android';

    getPermissionsAsyncMock.mockResolvedValue({ granted: true, canAskAgain: true, ios: null });
    requestPermissionsAsyncMock.mockResolvedValue({ granted: false, canAskAgain: false, ios: null });
    getExpoPushTokenAsyncMock.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    rpcMock.mockResolvedValue({ error: null });
  });

  it('registers push notifications after permission checks', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    const token = await repository.registerPushNotifications('viewer-1');

    expect(setNotificationChannelAsyncMock).toHaveBeenCalledWith(
      androidNotificationChannelId,
      expect.objectContaining({
        description: expect.any(String),
        importance: 'max',
        lockscreenVisibility: 1,
        name: androidNotificationChannelName,
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith('upsert_user_push_token', {
      input_platform: 'android',
      input_token: 'ExponentPushToken[test]',
    });
    expect(token).toBe('ExponentPushToken[test]');
  });

  it('converts refreshed device push tokens into Expo push tokens', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    const devicePushToken = { type: 'android' as const, data: 'native-fcm-token' };

    const token = await repository.registerDevicePushToken('viewer-1', devicePushToken);

    expect(getExpoPushTokenAsyncMock).toHaveBeenCalledWith({
      projectId: 'project-id',
      devicePushToken,
    });
    expect(rpcMock).toHaveBeenCalledWith('upsert_user_push_token', {
      input_platform: 'android',
      input_token: 'ExponentPushToken[test]',
    });
    expect(token).toBe('ExponentPushToken[test]');
  });

  it('skips registration when the feature flag is disabled', async () => {
    const { env } = await import('@/mobile/app/platform/config/env');
    env.pushNotificationsEnabledOverride = false;
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    notificationRuntime.featureEnabled = false;
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBeNull();
    expect(infoMock).toHaveBeenCalledWith(
      'push',
      'Push registration skipped because feature flag is disabled.',
    );
  });

  it('skips registration in Expo Go and on unsupported devices', async () => {
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    notificationRuntime.isExpoGo = true;
    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBeNull();

    notificationRuntime.isExpoGo = false;
    notificationRuntime.supportsRemotePushRegistration = false;
    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBeNull();

    expect(infoMock).toHaveBeenCalledWith('push', 'Push registration skipped in Expo Go.');
    expect(infoMock).toHaveBeenCalledWith(
      'push',
      'Push registration skipped because remote push is unavailable on this device.',
    );
  });

  it('skips registration when the project id is missing', async () => {
    const { env } = await import('@/mobile/app/platform/config/env');
    env.expoProjectId = '';
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBeNull();
    expect(warnMock).toHaveBeenCalledWith(
      'push',
      'Expo project id is missing. Push token registration skipped.',
    );
  });

  it('requests permissions when needed and stops when permission stays denied', async () => {
    getPermissionsAsyncMock.mockResolvedValue({ granted: false, canAskAgain: true, ios: null });
    requestPermissionsAsyncMock.mockResolvedValue({ granted: false, canAskAgain: false, ios: null });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBeNull();
    expect(requestPermissionsAsyncMock).toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      'push',
      'Push notification permission was not granted.',
    );
  });

  it('upgrades provisional ios permissions to full alerts when possible', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';
    getPermissionsAsyncMock.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      ios: {
        status: 3,
        allowsAlert: false,
        allowsSound: false,
        allowsDisplayOnLockScreen: false,
        allowsDisplayInNotificationCenter: true,
      },
    });
    requestPermissionsAsyncMock.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      ios: {
        status: 2,
        allowsAlert: true,
        allowsSound: true,
        allowsDisplayOnLockScreen: true,
        allowsDisplayInNotificationCenter: true,
      },
    });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBe('ExponentPushToken[test]');
    expect(setNotificationChannelAsyncMock).not.toHaveBeenCalled();
    expect(requestPermissionsAsyncMock).toHaveBeenCalledWith({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowProvisional: false,
        provideAppNotificationSettings: true,
      },
    });
    expect(rpcMock).toHaveBeenCalledWith('upsert_user_push_token', {
      input_platform: 'ios',
      input_token: 'ExponentPushToken[test]',
    });
  });

  it('keeps ios registration active but warns when permission stays quiet', async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';
    getPermissionsAsyncMock.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      ios: {
        status: 3,
        allowsAlert: false,
        allowsSound: false,
        allowsDisplayOnLockScreen: false,
        allowsDisplayInNotificationCenter: true,
      },
    });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBe('ExponentPushToken[test]');
    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      'push',
      'iOS notification permission is limited. Notifications may arrive quietly until alerts, sounds, lock screen, and notification center are enabled in Settings.',
    );
  });

  it('warns when the push token cannot be resolved', async () => {
    getExpoPushTokenAsyncMock.mockResolvedValue({ data: '' });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBeNull();
    expect(warnMock).toHaveBeenCalledWith('push', 'Expo push token could not be resolved.');
  });

  it('propagates registration rpc errors', async () => {
    rpcMock.mockResolvedValue({ error: new Error('rpc failed') });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).rejects.toThrow('rpc failed');
  });

  it('unregisters the provided push token directly', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    await repository.unregisterPushNotifications('provided-token');

    expect(rpcMock).toHaveBeenCalledWith('remove_user_push_token', {
      input_token: 'provided-token',
    });
  });

  it('resolves the current token when unregistering without an explicit token', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    await repository.unregisterPushNotifications(null);

    expect(getExpoPushTokenAsyncMock).toHaveBeenCalledWith({ projectId: 'project-id' });
    expect(rpcMock).toHaveBeenCalledWith('remove_user_push_token', {
      input_token: 'ExponentPushToken[test]',
    });
  });

  it('skips unregister when feature access is disabled or no token is available', async () => {
    const { env } = await import('@/mobile/app/platform/config/env');
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    env.pushNotificationsEnabledOverride = false;
    notificationRuntime.featureEnabled = false;
    await repository.unregisterPushNotifications(null);

    env.pushNotificationsEnabledOverride = true;
    notificationRuntime.featureEnabled = true;
    notificationRuntime.isExpoGo = true;
    await repository.unregisterPushNotifications(null);

    notificationRuntime.isExpoGo = false;
    env.expoProjectId = '';
    await repository.unregisterPushNotifications(null);

    env.expoProjectId = 'project-id';
    getPermissionsAsyncMock.mockResolvedValue({ granted: false, canAskAgain: true, ios: null });
    await repository.unregisterPushNotifications(null);

    getPermissionsAsyncMock.mockResolvedValue({ granted: true, canAskAgain: true, ios: null });
    getExpoPushTokenAsyncMock.mockResolvedValue({ data: '' });
    await repository.unregisterPushNotifications(null);

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('propagates unregister rpc errors', async () => {
    rpcMock.mockResolvedValue({ error: new Error('remove failed') });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.unregisterPushNotifications('provided-token')).rejects.toThrow('remove failed');
  });

  it('removes every push token for the authenticated user during logout', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await repository.unregisterAllPushNotifications();

    expect(rpcMock).toHaveBeenCalledWith('remove_all_user_push_tokens');
  });

  it('propagates remove-all push token rpc errors', async () => {
    rpcMock.mockResolvedValue({ error: new Error('remove all failed') });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.unregisterAllPushNotifications()).rejects.toThrow('remove all failed');
  });
});
