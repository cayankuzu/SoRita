import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState: { booted: boolean; user: { id: string } | null } = {
  booted: true,
  user: null,
};

function AuthScopedControllerHost({ Controller }: { Controller: React.ComponentType }) {
  return authState.booted && authState.user ? <Controller /> : null;
}

const notificationRuntimeState = {
  featureEnabled: true,
  supportsNotificationObservers: false,
  supportsRemotePushRegistration: true,
};
const ensureAndroidPushChannelMock = vi.fn();
const flushPendingPushTokenCleanupTombstonesMock = vi.fn();
const prepareRegisteredPushTokenAccountSwitchCleanupMock = vi.fn();
const registerPushNotificationsMock = vi.fn();
const registerDevicePushTokenMock = vi.fn();
const getNotificationCountMock = vi.fn();
const getNotificationsPageMock = vi.fn();
const setQueryDataMock = vi.fn();
const loggerDebugMock = vi.fn();
const loggerWarnMock = vi.fn();
const setNotificationHandlerMock = vi.fn();
const appStateSubscriptionRemoveMock = vi.fn();
const addNotificationResponseReceivedListenerMock = vi.fn();
const clearLastNotificationResponseAsyncMock = vi.fn();
const getLastNotificationResponseAsyncMock = vi.fn();
const navigateMock = vi.fn();

let appStateChangeHandler: ((state: AppStateStatus) => void) | null = null;
let notificationResponseHandler: ((response: NotificationResponseFixture) => void) | null = null;
let notificationReceivedHandler: ((notification: ReceivedNotificationFixture) => void) | null = null;

type ReceivedNotificationFixture = {
  request: {
    content: { body: string | null; data: Record<string, unknown>; title: string | null };
    identifier: string;
  };
};

type NotificationResponseFixture = {
  notification: {
    request: {
      content: { data: Record<string, unknown> };
      identifier: string;
    };
  };
};

vi.mock('@/mobile/app/app-shell/auth/AuthSessionProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  flushPendingPushTokenCleanupTombstones: flushPendingPushTokenCleanupTombstonesMock,
  prepareRegisteredPushTokenAccountSwitchCleanup: prepareRegisteredPushTokenAccountSwitchCleanupMock,
  registerDevicePushToken: registerDevicePushTokenMock,
  registerPushNotifications: registerPushNotificationsMock,
}));

vi.mock('@/mobile/app/platform/notifications/androidPushChannel', () => ({
  ensureAndroidPushChannel: ensureAndroidPushChannelMock,
}));

vi.mock('@/mobile/app/data/repositories/notificationRepository', () => ({
  getNotificationCount: getNotificationCountMock,
  getNotificationsPage: getNotificationsPageMock,
  getVerifiedPushNotificationTarget: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('@/mobile/app/platform/notifications/runtime', () => ({
  notificationRuntime: notificationRuntimeState,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: loggerDebugMock,
    warn: loggerWarnMock,
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
    setQueryData: setQueryDataMock,
  },
}));

vi.mock('@/mobile/app/app-shell/navigation/navigationRef', () => ({
  rootNavigationRef: {
    isReady: () => true,
    navigate: navigateMock,
  },
}));

vi.mock('expo-notifications', () => ({
  AndroidNotificationPriority: { MAX: 'max' },
  addNotificationReceivedListener: vi.fn((listener) => {
    notificationReceivedHandler = listener;
    return { remove: vi.fn() };
  }),
  addNotificationResponseReceivedListener: addNotificationResponseReceivedListenerMock,
  addPushTokenListener: vi.fn(() => ({ remove: vi.fn() })),
  clearLastNotificationResponseAsync: clearLastNotificationResponseAsyncMock,
  getLastNotificationResponseAsync: getLastNotificationResponseAsyncMock,
  setNotificationHandler: setNotificationHandlerMock,
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function hasQueryCacheWrite(queryKey: readonly unknown[]) {
  return setQueryDataMock.mock.calls.some(([actualQueryKey]) =>
    JSON.stringify(actualQueryKey) === JSON.stringify(queryKey));
}

function getQueryCacheWrite(queryKey: readonly unknown[]) {
  return setQueryDataMock.mock.calls.find(([actualQueryKey]) =>
    JSON.stringify(actualQueryKey) === JSON.stringify(queryKey));
}

async function renderController() {
  const { PushNotificationsController } = await import(
    '@/mobile/app/app-shell/notifications/PushNotificationsController'
  );
  let renderer!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = TestRenderer.create(<PushNotificationsController />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer;
}

async function triggerAppActive() {
  expect(appStateChangeHandler).not.toBeNull();

  await act(async () => {
    appStateChangeHandler?.('active');
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  authState.booted = true;
  authState.user = { id: 'account-a' };
  notificationRuntimeState.featureEnabled = true;
  notificationRuntimeState.supportsNotificationObservers = false;
  notificationRuntimeState.supportsRemotePushRegistration = true;
  appStateChangeHandler = null;
  notificationResponseHandler = null;
  notificationReceivedHandler = null;

  ensureAndroidPushChannelMock.mockReset();
  ensureAndroidPushChannelMock.mockResolvedValue(undefined);
  getNotificationCountMock.mockReset();
  getNotificationCountMock.mockResolvedValue(0);
  getNotificationsPageMock.mockReset();
  getNotificationsPageMock.mockResolvedValue([]);
  setQueryDataMock.mockReset();
  loggerDebugMock.mockReset();
  loggerWarnMock.mockReset();
  setNotificationHandlerMock.mockReset();
  appStateSubscriptionRemoveMock.mockReset();
  addNotificationResponseReceivedListenerMock.mockReset();
  addNotificationResponseReceivedListenerMock.mockImplementation((listener) => {
    notificationResponseHandler = listener;
    return { remove: vi.fn() };
  });
  clearLastNotificationResponseAsyncMock.mockReset();
  clearLastNotificationResponseAsyncMock.mockResolvedValue(undefined);
  getLastNotificationResponseAsyncMock.mockReset();
  getLastNotificationResponseAsyncMock.mockResolvedValue(null);
  navigateMock.mockReset();

  vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateChangeHandler = listener;
    return { remove: appStateSubscriptionRemoveMock };
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
});

describe('PushNotificationsController notification synchronization', () => {
  it('deduplicates concurrent presentation setup and retries after a rejected setup', async () => {
    notificationRuntimeState.supportsNotificationObservers = true;
    const initializationError = new Error('channel initialization failed');
    ensureAndroidPushChannelMock
      .mockRejectedValueOnce(initializationError)
      .mockResolvedValue(undefined);
    setNotificationHandlerMock.mockReturnValue(undefined);
    const { ensureForegroundNotificationPresentation } = await import(
      '@/mobile/app/app-shell/notifications/PushNotificationsController'
    );
    const { foregroundNotificationPresentationInternals } = await import(
      '@/mobile/app/platform/notifications/foregroundNotificationPresentation'
    );
    foregroundNotificationPresentationInternals.resetForTests();

    const firstAttempt = ensureForegroundNotificationPresentation();
    const concurrentAttempt = ensureForegroundNotificationPresentation();
    const failedAttempts = Promise.allSettled([firstAttempt, concurrentAttempt]);

    // The handler is installed synchronously, before channel I/O settles.
    expect(setNotificationHandlerMock).toHaveBeenCalledTimes(1);
    expect(ensureAndroidPushChannelMock).toHaveBeenCalledTimes(1);

    await expect(failedAttempts).resolves.toEqual([
      { reason: initializationError, status: 'rejected' },
      { reason: initializationError, status: 'rejected' },
    ]);
    await expect(ensureForegroundNotificationPresentation()).resolves.toBeUndefined();
    expect(ensureAndroidPushChannelMock).toHaveBeenCalledTimes(2);
    expect(setNotificationHandlerMock).toHaveBeenCalledTimes(2);

    await expect(Promise.all([
      ensureForegroundNotificationPresentation(),
      ensureForegroundNotificationPresentation(),
    ])).resolves.toEqual([undefined, undefined]);
    expect(ensureAndroidPushChannelMock).toHaveBeenCalledTimes(2);
    expect(setNotificationHandlerMock).toHaveBeenCalledTimes(2);
  });

  it('consumes a cold-start response once and deduplicates the matching live response', async () => {
    notificationRuntimeState.supportsNotificationObservers = true;
    const response: NotificationResponseFixture = {
      notification: {
        request: {
          content: { data: {} },
          identifier: 'provider-response-1',
        },
      },
    };
    getLastNotificationResponseAsyncMock.mockResolvedValue(response);
    const renderer = await renderController();

    expect((await import('@/mobile/app/platform/notifications/runtime')).notificationRuntime
      .supportsNotificationObservers).toBe(true);

    await vi.waitFor(() => {
      expect(addNotificationResponseReceivedListenerMock).toHaveBeenCalledOnce();
      expect(getLastNotificationResponseAsyncMock).toHaveBeenCalledOnce();
      expect(clearLastNotificationResponseAsyncMock).toHaveBeenCalledOnce();
    });
    expect(navigateMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith('Notifications');

    act(() => {
      notificationResponseHandler?.(response);
    });
    expect(navigateMock).toHaveBeenCalledOnce();

    await act(async () => {
      renderer.unmount();
    });
  });

  it('does not consume or navigate a deferred cold response after logout unmounts the controller', async () => {
    notificationRuntimeState.supportsNotificationObservers = true;
    const deferredResponse = createDeferred<NotificationResponseFixture | null>();
    getLastNotificationResponseAsyncMock.mockReturnValue(deferredResponse.promise);
    const { PushNotificationsController } = await import(
      '@/mobile/app/app-shell/notifications/PushNotificationsController'
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <AuthScopedControllerHost Controller={PushNotificationsController} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    authState.user = null;
    await act(async () => {
      renderer.update(<AuthScopedControllerHost Controller={PushNotificationsController} />);
      await Promise.resolve();
    });

    deferredResponse.resolve({
      notification: {
        request: {
          content: { data: {} },
          identifier: 'stale-response',
        },
      },
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearLastNotificationResponseAsyncMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });

  it('fetches the latest page and authoritative unread count in parallel', async () => {
    const notificationsRequest = createDeferred<Array<{ id: string; read: boolean }>>();
    const unreadCountRequest = createDeferred<number>();
    getNotificationsPageMock.mockReturnValueOnce(notificationsRequest.promise);
    getNotificationCountMock.mockReturnValueOnce(unreadCountRequest.promise);
    const renderer = await renderController();

    await triggerAppActive();

    expect(getNotificationsPageMock).toHaveBeenCalledWith('account-a', 0, 20);
    expect(getNotificationCountMock).toHaveBeenCalledWith('account-a');

    await act(async () => {
      unreadCountRequest.resolve(27);
      await Promise.resolve();
    });

    expect(getQueryCacheWrite(['notifications', 'unread-count', 'account-a'])).toEqual([
      ['notifications', 'unread-count', 'account-a'],
      27,
    ]);
    expect(hasQueryCacheWrite(['notifications', 'list', 'account-a'])).toBe(false);

    const notifications = [
      { id: 'notification-1', read: false },
      { id: 'notification-2', read: true },
    ];
    await act(async () => {
      notificationsRequest.resolve(notifications);
      await Promise.resolve();
    });

    const listWrite = getQueryCacheWrite(['notifications', 'list', 'account-a']);
    expect(listWrite?.[1]).toBeTypeOf('function');
    expect((listWrite?.[1] as (current: unknown) => unknown)(undefined)).toEqual({
      pageParams: [0],
      pages: [notifications],
    });
    expect(setQueryDataMock).not.toHaveBeenCalledWith(
      ['notifications', 'unread-count', 'account-a'],
      1,
    );

    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps a newer same-user hydration when an older request finishes last', async () => {
    const olderNotificationsRequest = createDeferred<Array<{ id: string; read: boolean }>>();
    const olderUnreadCountRequest = createDeferred<number>();
    const newerNotificationsRequest = createDeferred<Array<{ id: string; read: boolean }>>();
    const newerUnreadCountRequest = createDeferred<number>();
    getNotificationsPageMock
      .mockReturnValueOnce(olderNotificationsRequest.promise)
      .mockReturnValueOnce(newerNotificationsRequest.promise);
    getNotificationCountMock
      .mockReturnValueOnce(olderUnreadCountRequest.promise)
      .mockReturnValueOnce(newerUnreadCountRequest.promise);
    const renderer = await renderController();

    await triggerAppActive();
    await triggerAppActive();

    expect(getNotificationsPageMock).toHaveBeenCalledTimes(2);
    expect(getNotificationCountMock).toHaveBeenCalledTimes(2);

    const newerNotifications = [{ id: 'newer-notification', read: false }];
    await act(async () => {
      newerNotificationsRequest.resolve(newerNotifications);
      newerUnreadCountRequest.resolve(7);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setQueryDataMock).toHaveBeenCalledTimes(2);
    expect(getQueryCacheWrite(['notifications', 'unread-count', 'account-a'])).toEqual([
      ['notifications', 'unread-count', 'account-a'],
      7,
    ]);
    const listWrite = getQueryCacheWrite(['notifications', 'list', 'account-a']);
    expect((listWrite?.[1] as (current: unknown) => unknown)(undefined)).toEqual({
      pageParams: [0],
      pages: [newerNotifications],
    });

    await act(async () => {
      olderNotificationsRequest.resolve([{ id: 'older-notification', read: true }]);
      olderUnreadCountRequest.resolve(99);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setQueryDataMock).toHaveBeenCalledTimes(2);
    expect(setQueryDataMock).not.toHaveBeenCalledWith(
      ['notifications', 'unread-count', 'account-a'],
      99,
    );

    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps the authoritative unread count update when the page request fails', async () => {
    const pageError = new Error('page unavailable');
    getNotificationsPageMock.mockRejectedValueOnce(pageError);
    getNotificationCountMock.mockResolvedValueOnce(9);
    const renderer = await renderController();

    await triggerAppActive();

    expect(hasQueryCacheWrite(['notifications', 'list', 'account-a'])).toBe(false);
    expect(getQueryCacheWrite(['notifications', 'unread-count', 'account-a'])).toEqual([
      ['notifications', 'unread-count', 'account-a'],
      9,
    ]);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'push',
      'Failed to hydrate latest notifications cache (foreground)',
      pageError,
    );

    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps the page update without deriving a count when the count request fails', async () => {
    const countError = new Error('count unavailable');
    const notifications = [
      { id: 'notification-1', read: false },
      { id: 'notification-2', read: false },
    ];
    getNotificationsPageMock.mockResolvedValueOnce(notifications);
    getNotificationCountMock.mockRejectedValueOnce(countError);
    const renderer = await renderController();

    await triggerAppActive();

    expect(hasQueryCacheWrite(['notifications', 'list', 'account-a'])).toBe(true);
    expect(hasQueryCacheWrite(['notifications', 'unread-count', 'account-a'])).toBe(false);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'push',
      'Failed to hydrate notification unread count (foreground)',
      countError,
    );

    await act(async () => {
      renderer.unmount();
    });
  });

  it('discards notification results that complete after the authenticated user changes', async () => {
    const { PushNotificationsController } = await import(
      '@/mobile/app/app-shell/notifications/PushNotificationsController'
    );
    const notificationsRequest = createDeferred<Array<{ id: string; read: boolean }>>();
    const unreadCountRequest = createDeferred<number>();
    getNotificationsPageMock.mockReturnValueOnce(notificationsRequest.promise);
    getNotificationCountMock.mockReturnValueOnce(unreadCountRequest.promise);
    const renderer = await renderController();

    await triggerAppActive();
    expect(getNotificationsPageMock).toHaveBeenCalledWith('account-a', 0, 20);
    expect(getNotificationCountMock).toHaveBeenCalledWith('account-a');

    authState.user = { id: 'account-b' };
    await act(async () => {
      renderer.update(<PushNotificationsController />);
      await Promise.resolve();
    });

    await act(async () => {
      notificationsRequest.resolve([{ id: 'stale-a', read: false }]);
      unreadCountRequest.resolve(41);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hasQueryCacheWrite(['notifications', 'list', 'account-a'])).toBe(false);
    expect(hasQueryCacheWrite(['notifications', 'unread-count', 'account-a'])).toBe(false);
    expect(hasQueryCacheWrite(['notifications', 'list', 'account-b'])).toBe(false);
    expect(hasQueryCacheWrite(['notifications', 'unread-count', 'account-b'])).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('discards deferred results after the auth wrapper unmounts the controller on logout', async () => {
    const { PushNotificationsController } = await import(
      '@/mobile/app/app-shell/notifications/PushNotificationsController'
    );
    const notificationsRequest = createDeferred<Array<{ id: string; read: boolean }>>();
    const unreadCountRequest = createDeferred<number>();
    getNotificationsPageMock.mockReturnValueOnce(notificationsRequest.promise);
    getNotificationCountMock.mockReturnValueOnce(unreadCountRequest.promise);
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <AuthScopedControllerHost Controller={PushNotificationsController} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await triggerAppActive();

    authState.user = null;
    await act(async () => {
      renderer.update(<AuthScopedControllerHost Controller={PushNotificationsController} />);
      await Promise.resolve();
    });

    await act(async () => {
      notificationsRequest.resolve([{ id: 'logged-out-account-data', read: false }]);
      unreadCountRequest.resolve(14);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setQueryDataMock).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });
});

describe('PushNotificationsController in-app banner', () => {
  it('shows a push received in the open app as its own banner, which opens its target', async () => {
    notificationRuntimeState.supportsNotificationObservers = true;
    const {
      inAppPushBannerInternals,
      showsForegroundPushesInApp,
      subscribeToInAppPushBanners,
    } = await import('@/mobile/app/platform/notifications/inAppPushBanner');
    inAppPushBannerInternals.reset();
    const host = vi.fn();
    const unsubscribe = subscribeToInAppPushBanners(host);
    const renderer = await renderController();

    await vi.waitFor(() => {
      expect(notificationReceivedHandler).not.toBeNull();
    });
    expect(showsForegroundPushesInApp()).toBe(true);

    await act(async () => {
      notificationReceivedHandler?.({
        request: {
          content: { body: 'listeni beğendi', data: {}, title: 'Ayşe' },
          identifier: 'push-1',
        },
      });
      await Promise.resolve();
    });

    expect(host).toHaveBeenCalledOnce();
    expect(host.mock.calls[0]?.[0]).toMatchObject({
      body: 'listeni beğendi',
      id: 'push-1',
      title: 'Ayşe',
    });

    act(() => {
      host.mock.calls[0]?.[0].onPress();
    });
    expect(navigateMock).toHaveBeenCalledWith('Notifications');

    await act(async () => {
      renderer.unmount();
    });
    // Signed out, the system decides again, and no banner is left waiting.
    expect(showsForegroundPushesInApp()).toBe(false);
    unsubscribe();
  });
});

describe('PushNotificationsController account switching', () => {
  beforeEach(() => {
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
