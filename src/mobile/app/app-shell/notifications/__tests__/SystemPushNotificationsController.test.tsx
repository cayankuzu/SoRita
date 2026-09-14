import React from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RemoteMessage = {
  data?: Record<string, string | object>;
  messageId?: string | null;
  notification?: {
    body?: string | null;
    title?: string | null;
  } | null;
};

const authState: { booted: boolean; user: { id: string } | null } = {
  booted: true,
  user: { id: 'account-a' },
};
const notificationRuntimeState = {
  supportsRemotePushRegistration: true,
};

const presentForegroundSystemPushNotificationMock = vi.fn();
const syncSystemPushNotificationsMock = vi.fn();
const unregisterSystemPushNotificationsMock = vi.fn();
const loggerDebugMock = vi.fn();
const loggerWarnMock = vi.fn();
const navigateMock = vi.fn();
const onlineUnsubscribeMock = vi.fn();
const appStateSubscriptionRemoveMock = vi.fn();

const getMessagingMock = vi.fn(() => ({ name: 'messaging' }));
const getInitialNotificationMock = vi.fn();
const onMessageMock = vi.fn();
const onNotificationOpenedAppMock = vi.fn();
const onTokenRefreshMock = vi.fn();
const loadFirebaseMessagingModuleMock = vi.fn();
const unsubscribeOnMessageMock = vi.fn();
const unsubscribeOnOpenedMock = vi.fn();
const unsubscribeOnTokenRefreshMock = vi.fn();

let foregroundMessageHandler: ((message: RemoteMessage) => Promise<void>) | null = null;

const firebaseMessagingModule = {
  getInitialNotification: getInitialNotificationMock,
  getMessaging: getMessagingMock,
  onMessage: onMessageMock,
  onNotificationOpenedApp: onNotificationOpenedAppMock,
  onTokenRefresh: onTokenRefreshMock,
};

vi.mock('@/mobile/app/app-shell/auth/AuthSessionProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/mobile/app/data/repositories/systemPushNotificationRepository', () => ({
  presentForegroundSystemPushNotification: presentForegroundSystemPushNotificationMock,
  syncSystemPushNotifications: syncSystemPushNotificationsMock,
  unregisterSystemPushNotifications: unregisterSystemPushNotificationsMock,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: loggerDebugMock,
    warn: loggerWarnMock,
  },
}));

vi.mock('@/mobile/app/platform/notifications/firebaseMessaging', () => ({
  loadFirebaseMessagingModule: loadFirebaseMessagingModuleMock,
}));

vi.mock('@/mobile/app/platform/notifications/runtime', () => ({
  notificationRuntime: notificationRuntimeState,
}));

vi.mock('@/mobile/app/app-shell/navigation/navigationRef', () => ({
  rootNavigationRef: {
    isReady: () => true,
    navigate: navigateMock,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  onlineManager: {
    subscribe: vi.fn(() => onlineUnsubscribeMock),
  },
}));

function AuthScopedControllerHost({ Controller }: { Controller: React.ComponentType }) {
  return authState.booted && authState.user ? <Controller /> : null;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function renderController(scopedToAuth = false) {
  const { SystemPushNotificationsController } = await import(
    '@/mobile/app/app-shell/notifications/SystemPushNotificationsController'
  );
  let renderer!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = TestRenderer.create(
      scopedToAuth
        ? <AuthScopedControllerHost Controller={SystemPushNotificationsController} />
        : <SystemPushNotificationsController />,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return { renderer, SystemPushNotificationsController };
}

beforeEach(async () => {
  vi.clearAllMocks();
  authState.booted = true;
  authState.user = { id: 'account-a' };
  notificationRuntimeState.supportsRemotePushRegistration = true;
  foregroundMessageHandler = null;

  presentForegroundSystemPushNotificationMock.mockResolvedValue(undefined);
  syncSystemPushNotificationsMock.mockResolvedValue('fcm-token');
  unregisterSystemPushNotificationsMock.mockResolvedValue(undefined);
  getInitialNotificationMock.mockResolvedValue(null);
  onMessageMock.mockImplementation((_messaging, listener) => {
    foregroundMessageHandler = listener;
    return unsubscribeOnMessageMock;
  });
  onNotificationOpenedAppMock.mockImplementation(() => {
    return unsubscribeOnOpenedMock;
  });
  onTokenRefreshMock.mockImplementation(() => {
    return unsubscribeOnTokenRefreshMock;
  });
  loadFirebaseMessagingModuleMock.mockResolvedValue(firebaseMessagingModule);

  vi.spyOn(AppState, 'addEventListener').mockImplementation(() => {
    return { remove: appStateSubscriptionRemoveMock };
  });

  const { systemPushNotificationsControllerInternals } = await import(
    '@/mobile/app/app-shell/notifications/SystemPushNotificationsController'
  );
  systemPushNotificationsControllerInternals.resetForTests();
});

afterEach(async () => {
  const { systemPushNotificationsControllerInternals } = await import(
    '@/mobile/app/app-shell/notifications/SystemPushNotificationsController'
  );
  systemPushNotificationsControllerInternals.resetForTests();
  vi.clearAllTimers();
  vi.restoreAllMocks();
});

describe('SystemPushNotificationsController', () => {
  it('presents concurrent foreground deliveries with the same FCM message id only once', async () => {
    const presentation = createDeferred<void>();
    presentForegroundSystemPushNotificationMock.mockReturnValueOnce(presentation.promise);
    const { renderer } = await renderController();

    expect(foregroundMessageHandler).not.toBeNull();
    const remoteMessage = {
      messageId: 'message-1',
      notification: { body: 'Body', title: 'Title' },
    };

    let firstPresentation!: Promise<void>;
    let duplicatePresentation!: Promise<void>;
    await act(async () => {
      firstPresentation = foregroundMessageHandler?.(remoteMessage) ?? Promise.resolve();
      duplicatePresentation = foregroundMessageHandler?.(remoteMessage) ?? Promise.resolve();
      await duplicatePresentation;
    });

    expect(presentForegroundSystemPushNotificationMock).toHaveBeenCalledTimes(1);
    expect(presentForegroundSystemPushNotificationMock).toHaveBeenCalledWith(remoteMessage);

    await act(async () => {
      presentation.resolve();
      await firstPresentation;
    });

    await act(async () => {
      renderer.unmount();
    });
  });

  it('ignores a delayed cold-open result after logout unmounts the controller', async () => {
    const initialNotification = createDeferred<RemoteMessage | null>();
    getInitialNotificationMock.mockReturnValueOnce(initialNotification.promise);
    const { renderer, SystemPushNotificationsController } = await renderController(true);

    expect(getInitialNotificationMock).toHaveBeenCalledOnce();
    authState.user = null;
    await act(async () => {
      renderer.update(
        <AuthScopedControllerHost Controller={SystemPushNotificationsController} />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      initialNotification.resolve({ messageId: 'cold-after-logout' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(unsubscribeOnMessageMock).toHaveBeenCalledOnce();
    expect(unsubscribeOnOpenedMock).toHaveBeenCalledOnce();
    expect(unsubscribeOnTokenRefreshMock).toHaveBeenCalledOnce();

    await act(async () => {
      renderer.unmount();
    });
  });

  it('ignores an account-a cold-open result that resolves after switching to account-b', async () => {
    const accountAInitialNotification = createDeferred<RemoteMessage | null>();
    getInitialNotificationMock
      .mockReturnValueOnce(accountAInitialNotification.promise)
      .mockResolvedValueOnce(null);
    const { renderer, SystemPushNotificationsController } = await renderController();

    authState.user = { id: 'account-b' };
    await act(async () => {
      renderer.update(<SystemPushNotificationsController />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      accountAInitialNotification.resolve({ messageId: 'cold-for-account-a' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(getInitialNotificationMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('unregisters safely when a subscription finishes after logout', async () => {
    const registration = createDeferred<string | null>();
    syncSystemPushNotificationsMock.mockReturnValueOnce(registration.promise);
    const { renderer, SystemPushNotificationsController } = await renderController(true);

    expect(syncSystemPushNotificationsMock).toHaveBeenCalledOnce();
    authState.user = null;
    await act(async () => {
      renderer.update(
        <AuthScopedControllerHost Controller={SystemPushNotificationsController} />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      registration.resolve('late-fcm-token');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(unregisterSystemPushNotificationsMock).toHaveBeenCalledOnce();

    await act(async () => {
      renderer.unmount();
    });
  });

  it('unsubscribes from the device-wide topic on a normal logout', async () => {
    const { renderer, SystemPushNotificationsController } = await renderController(true);

    expect(syncSystemPushNotificationsMock).toHaveBeenCalledOnce();
    authState.user = null;
    await act(async () => {
      renderer.update(
        <AuthScopedControllerHost Controller={SystemPushNotificationsController} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(unregisterSystemPushNotificationsMock).toHaveBeenCalledOnce();

    await act(async () => {
      renderer.unmount();
    });
  });
});
