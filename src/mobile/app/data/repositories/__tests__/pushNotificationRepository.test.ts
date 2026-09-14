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
    PRIVATE: 0,
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
    const { pushPermissionInternals } = await import('@/mobile/app/platform/notifications/pushPermission');
    const { AppState, Platform } = await import('react-native');

    env.expoProjectId = 'project-id';
    env.pushNotificationsEnabledOverride = true;
    notificationRuntime.isExpoGo = false;
    notificationRuntime.featureEnabled = true;
    notificationRuntime.supportsRemotePushRegistration = true;
    Platform.OS = 'android';
    (AppState as typeof AppState & { currentState: 'active' }).currentState = 'active';
    pushPermissionInternals.resetForTests();

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
        lockscreenVisibility: 0,
        name: androidNotificationChannelName,
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith('upsert_user_push_token', expect.objectContaining({
      input_cleanup_secret: expect.stringMatching(/^[a-f0-9]{64}$/u),
      input_platform: 'android',
      input_token: 'ExponentPushToken[test]',
    }));
    expect(token).toBe('ExponentPushToken[test]');
    expect(setNotificationChannelAsyncMock.mock.invocationCallOrder[0]).toBeLessThan(
      getPermissionsAsyncMock.mock.invocationCallOrder[0],
    );
  });

  it('reuses the bound cleanup capability for a same-token heartbeat', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await repository.registerPushNotifications('viewer-1');
    await repository.registerPushNotifications('viewer-1');

    const upserts = rpcMock.mock.calls.filter(([operation]) => (
      operation === 'upsert_user_push_token'
    ));
    expect(upserts).toHaveLength(2);
    expect(upserts[1]?.[1]).toMatchObject({
      input_cleanup_secret: upserts[0]?.[1]?.input_cleanup_secret,
      input_token: 'ExponentPushToken[test]',
    });
    expect(rpcMock).not.toHaveBeenCalledWith(
      'revoke_push_token_with_cleanup_secret',
      expect.anything(),
    );
  });

  it('rotates cleanup capability and revokes the prior token only after the new bind succeeds', async () => {
    getExpoPushTokenAsyncMock
      .mockResolvedValueOnce({ data: 'ExponentPushToken[old]' })
      .mockResolvedValueOnce({ data: 'ExponentPushToken[new]' });
    rpcMock.mockImplementation(async (operation) => ({
      data: operation === 'revoke_push_token_with_cleanup_secret',
      error: null,
    }));
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    const { getActivePushTokenCleanupCapability } = await import(
      '@/mobile/app/platform/notifications/pushTokenCleanup'
    );

    await repository.registerPushNotifications('viewer-1');
    const oldCapability = await getActivePushTokenCleanupCapability();
    await repository.registerPushNotifications('viewer-1');

    const newCapability = await getActivePushTokenCleanupCapability();
    expect(newCapability).toMatchObject({ token: 'ExponentPushToken[new]' });
    expect(newCapability?.cleanupSecret).not.toBe(oldCapability?.cleanupSecret);
    expect(rpcMock).toHaveBeenCalledWith('revoke_push_token_with_cleanup_secret', {
      input_cleanup_secret: oldCapability?.cleanupSecret,
      input_token: 'ExponentPushToken[old]',
    });
  });

  it('restores the prior active capability when a rotated-token bind fails', async () => {
    getExpoPushTokenAsyncMock
      .mockResolvedValueOnce({ data: 'ExponentPushToken[old]' })
      .mockResolvedValueOnce({ data: 'ExponentPushToken[new]' });
    rpcMock.mockImplementation(async (operation, params) => ({
      error: operation === 'upsert_user_push_token'
        && params.input_token === 'ExponentPushToken[new]'
        ? new Error('new token bind failed')
        : null,
    }));
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    const {
      flushPendingPushTokenCleanupTombstones,
      getActivePushTokenCleanupCapability,
    } = await import('@/mobile/app/platform/notifications/pushTokenCleanup');

    await repository.registerPushNotifications('viewer-1');
    const previousCapability = await getActivePushTokenCleanupCapability();

    await expect(repository.registerPushNotifications('viewer-1')).rejects.toThrow(
      'new token bind failed',
    );

    await expect(getActivePushTokenCleanupCapability()).resolves.toEqual(previousCapability);
    await expect(flushPendingPushTokenCleanupTombstones()).resolves.toEqual({
      attempted: 0,
      pending: 0,
      revoked: 0,
    });
  });

  it('converts refreshed device push tokens into Expo push tokens', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    const devicePushToken = { type: 'android' as const, data: 'native-fcm-token' };

    const token = await repository.registerDevicePushToken('viewer-1', devicePushToken);

    expect(getExpoPushTokenAsyncMock).toHaveBeenCalledWith({
      projectId: 'project-id',
      devicePushToken,
    });
    expect(rpcMock).toHaveBeenCalledWith('upsert_user_push_token', expect.objectContaining({
      input_cleanup_secret: expect.stringMatching(/^[a-f0-9]{64}$/u),
      input_platform: 'android',
      input_token: 'ExponentPushToken[test]',
    }));
    expect(token).toBe('ExponentPushToken[test]');
    expect(getPermissionsAsyncMock).toHaveBeenCalledOnce();
    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
  });

  it('does not bind a refreshed native token after notification permission is revoked', async () => {
    getPermissionsAsyncMock.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      ios: null,
    });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerDevicePushToken('viewer-1', {
      type: 'android',
      data: 'native-fcm-token',
    })).resolves.toBeNull();

    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
    expect(getExpoPushTokenAsyncMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      'push',
      'Push token refresh ignored because notification permission is not granted.',
    );
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

  it('requests notification permission once from an interactive signed-in registration', async () => {
    getPermissionsAsyncMock.mockResolvedValue({ granted: false, canAskAgain: true, ios: null });
    requestPermissionsAsyncMock.mockResolvedValue({ granted: true, canAskAgain: true, ios: null });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBe(
      'ExponentPushToken[test]',
    );
    expect(requestPermissionsAsyncMock).toHaveBeenCalledOnce();
    expect(setNotificationChannelAsyncMock.mock.invocationCallOrder[0]).toBeLessThan(
      requestPermissionsAsyncMock.mock.invocationCallOrder[0],
    );
  });

  it('registers an already provisional ios permission without opening a system prompt', async () => {
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
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.registerPushNotifications('viewer-1')).resolves.toBe('ExponentPushToken[test]');
    expect(setNotificationChannelAsyncMock).not.toHaveBeenCalled();
    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      'push',
      'iOS notification permission is limited. Notifications may arrive quietly until alerts, sounds, lock screen, and notification center are enabled in Settings.',
    );
    expect(rpcMock).toHaveBeenCalledWith('upsert_user_push_token', expect.objectContaining({
      input_cleanup_secret: expect.stringMatching(/^[a-f0-9]{64}$/u),
      input_platform: 'ios',
      input_token: 'ExponentPushToken[test]',
    }));
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

    await expect(repository.registerPushNotifications('viewer-1')).rejects.toMatchObject({
      name: 'PushTokenAcquisitionError',
    });
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

    await repository.unregisterAllPushNotifications({
      cleanupSecret: 'a'.repeat(64),
      token: 'ExponentPushToken[test]',
    });

    expect(rpcMock).toHaveBeenCalledWith('remove_all_user_push_tokens');
  });

  it('propagates remove-all push token rpc errors', async () => {
    rpcMock.mockResolvedValue({ error: new Error('remove all failed') });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(repository.unregisterAllPushNotifications({
      cleanupSecret: 'a'.repeat(64),
      token: 'ExponentPushToken[test]',
    })).rejects.toThrow('remove all failed');
  });

  const quietPermissionWarning =
    'iOS notification permission is limited. Notifications may arrive quietly until alerts, sounds, lock screen, and notification center are enabled in Settings.';

  async function registerOnIos(iosPermissions: unknown, granted = false) {
    const { Platform } = await import('react-native');
    Platform.OS = 'ios';
    getPermissionsAsyncMock.mockResolvedValue({
      granted,
      canAskAgain: false,
      ios: iosPermissions,
    });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    return repository.registerPushNotifications('viewer-1');
  }

  it('registers an ephemeral ios permission without a system prompt', async () => {
    await expect(
      registerOnIos({
        status: 4,
        allowsAlert: true,
        allowsSound: true,
        allowsDisplayOnLockScreen: true,
        allowsDisplayInNotificationCenter: true,
      }),
    ).resolves.toBe('ExponentPushToken[test]');
    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
  });

  it('registers a fully authorized ios permission without the quiet warning', async () => {
    await expect(
      registerOnIos(
        {
          status: 2,
          allowsAlert: true,
          allowsSound: true,
          allowsDisplayOnLockScreen: true,
          allowsDisplayInNotificationCenter: true,
        },
        true,
      ),
    ).resolves.toBe('ExponentPushToken[test]');
    expect(warnMock).not.toHaveBeenCalledWith('push', quietPermissionWarning);
  });

  it.each([
    ['alerts', 'allowsAlert'],
    ['sound', 'allowsSound'],
    ['lock screen', 'allowsDisplayOnLockScreen'],
    ['notification center', 'allowsDisplayInNotificationCenter'],
  ])('warns when authorized ios permission has %s disabled', async (_label, disabledKey) => {
    const iosPermissions = {
      status: 2,
      allowsAlert: true,
      allowsSound: true,
      allowsDisplayOnLockScreen: true,
      allowsDisplayInNotificationCenter: true,
      [disabledKey]: false,
    };

    await expect(registerOnIos(iosPermissions, true)).resolves.toBe('ExponentPushToken[test]');
    expect(warnMock).toHaveBeenCalledWith('push', quietPermissionWarning);
  });

  it('falls back to the platform grant when ios permission detail is absent', async () => {
    await expect(registerOnIos(null, true)).resolves.toBe('ExponentPushToken[test]');
    expect(warnMock).not.toHaveBeenCalledWith('push', quietPermissionWarning);
  });

  it('skips device push token registration when push delivery is unavailable', async () => {
    const { notificationRuntime } = await import('@/mobile/app/platform/notifications/runtime');
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');
    const devicePushToken = { type: 'android' as const, data: 'native-fcm-token' };

    notificationRuntime.featureEnabled = false;
    await expect(repository.registerDevicePushToken('viewer-1', devicePushToken)).resolves.toBeNull();

    notificationRuntime.featureEnabled = true;
    notificationRuntime.isExpoGo = true;
    await expect(repository.registerDevicePushToken('viewer-1', devicePushToken)).resolves.toBeNull();

    notificationRuntime.isExpoGo = false;
    notificationRuntime.supportsRemotePushRegistration = false;
    await expect(repository.registerDevicePushToken('viewer-1', devicePushToken)).resolves.toBeNull();

    expect(getExpoPushTokenAsyncMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('skips device push token registration when the project id is missing', async () => {
    const { env } = await import('@/mobile/app/platform/config/env');
    env.expoProjectId = '';
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(
      repository.registerDevicePushToken('viewer-1', { type: 'android', data: 'native-fcm-token' }),
    ).resolves.toBeNull();
    expect(warnMock).toHaveBeenCalledWith(
      'push',
      'Expo project id is missing. Push token registration skipped.',
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('warns when a refreshed device push token cannot be converted', async () => {
    getExpoPushTokenAsyncMock.mockResolvedValue({ data: '' });
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(
      repository.registerDevicePushToken('viewer-1', { type: 'android', data: 'native-fcm-token' }),
    ).rejects.toMatchObject({ name: 'PushTokenAcquisitionError' });
    expect(warnMock).toHaveBeenCalledWith('push', 'Expo push token could not be resolved.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('does not stage an account-switch cleanup for an unknown or absent token', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(
      repository.prepareRegisteredPushTokenAccountSwitchCleanup(null),
    ).resolves.toBeNull();
    await expect(
      repository.prepareRegisteredPushTokenAccountSwitchCleanup('ExponentPushToken[other]'),
    ).resolves.toBeNull();
  });

  it('stages nothing for an auth transition when no capability was ever bound', async () => {
    const repository = await import('@/mobile/app/data/repositories/pushNotificationRepository');

    await expect(
      repository.stageActivePushTokenCleanupForAuthTransition(),
    ).resolves.toBeNull();
  });
});
