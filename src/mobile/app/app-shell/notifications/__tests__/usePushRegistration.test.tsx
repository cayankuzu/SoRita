import type { DevicePushToken } from 'expo-notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const flushCleanupMock = vi.fn();
const prepareCleanupMock = vi.fn();
const registerDeviceTokenMock = vi.fn();
const registerPushMock = vi.fn();
const loggerDebugMock = vi.fn();
const loggerWarnMock = vi.fn();
const addPushTokenListenerMock = vi.fn();
const removePushTokenListenerMock = vi.fn();
const unsubscribeOnlineMock = vi.fn();

let pushTokenListener: ((token: DevicePushToken) => void) | null = null;
let onlineListener: ((online: boolean) => void) | null = null;
let online = true;

vi.mock('@/mobile/app/data/repositories/pushNotificationRepository', () => ({
  flushPendingPushTokenCleanupTombstones: flushCleanupMock,
  prepareRegisteredPushTokenAccountSwitchCleanup: prepareCleanupMock,
  registerDevicePushToken: registerDeviceTokenMock,
  registerPushNotifications: registerPushMock,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: loggerDebugMock,
    warn: loggerWarnMock,
  },
}));

vi.mock('@/mobile/app/platform/notifications/runtime', () => ({
  notificationRuntime: {
    supportsRemotePushRegistration: true,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  onlineManager: {
    isOnline: vi.fn(() => online),
    subscribe: vi.fn((listener: (online: boolean) => void) => {
      onlineListener = listener;
      return unsubscribeOnlineMock;
    }),
  },
}));

vi.mock('expo-notifications', () => ({
  addPushTokenListener: addPushTokenListenerMock,
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('usePushRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushTokenListener = null;
    onlineListener = null;
    online = true;
    flushCleanupMock.mockResolvedValue({ attempted: 0, pending: 0, revoked: 0 });
    prepareCleanupMock.mockResolvedValue(null);
    registerPushMock.mockResolvedValue('ExponentPushToken[current]');
    registerDeviceTokenMock.mockResolvedValue('ExponentPushToken[rotated]');
    addPushTokenListenerMock.mockImplementation((listener: (token: DevicePushToken) => void) => {
      pushTokenListener = listener;
      return { remove: removePushTokenListenerMock };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('re-registers the same signed-in account on the foreground heartbeat', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const { pushRegistrationInternals, usePushRegistration } = await import(
      '@/mobile/app/app-shell/notifications/usePushRegistration'
    );
    const hook = renderHook(() => usePushRegistration({ booted: true, userId: 'account-a' }));

    await waitFor(() => expect(registerPushMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await hook.result.current.recoverPushRegistration();
    });
    expect(registerPushMock).toHaveBeenCalledTimes(1);

    now += pushRegistrationInternals.PUSH_REGISTRATION_HEARTBEAT_MS;
    await act(async () => {
      await hook.result.current.recoverPushRegistration();
    });
    expect(registerPushMock).toHaveBeenCalledTimes(2);

    hook.unmount();
  });

  it('makes no attempts while offline and registers as soon as the connection returns', async () => {
    // Offline, attempts failed at once and repeated several times a second.
    online = false;
    const { usePushRegistration } = await import(
      '@/mobile/app/app-shell/notifications/usePushRegistration'
    );
    const hook = renderHook(() => usePushRegistration({ booted: true, userId: 'account-a' }));
    await flushEffects();

    await act(async () => {
      await hook.result.current.recoverPushRegistration();
      await hook.result.current.syncPushRegistration();
    });
    expect(registerPushMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();

    online = true;
    await act(async () => {
      onlineListener?.(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(registerPushMock).toHaveBeenCalledTimes(1));
    hook.unmount();
  });

  it('recovers immediately when connectivity returns after token acquisition fails', async () => {
    registerPushMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('ExponentPushToken[online]');
    const { usePushRegistration } = await import(
      '@/mobile/app/app-shell/notifications/usePushRegistration'
    );
    const hook = renderHook(() => usePushRegistration({ booted: true, userId: 'account-a' }));

    await waitFor(() => expect(loggerWarnMock).toHaveBeenCalledOnce());
    expect(onlineListener).not.toBeNull();

    await act(async () => {
      onlineListener?.(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(registerPushMock).toHaveBeenCalledTimes(2));
    expect(registerPushMock).toHaveBeenLastCalledWith('account-a');
    hook.unmount();
  });

  it('does not lose a native token rotation that arrives during registration', async () => {
    const firstRegistration = createDeferred<string>();
    registerPushMock
      .mockReturnValueOnce(firstRegistration.promise)
      .mockResolvedValueOnce('ExponentPushToken[after-rotation]');
    const { usePushRegistration } = await import(
      '@/mobile/app/app-shell/notifications/usePushRegistration'
    );
    const hook = renderHook(() => usePushRegistration({ booted: true, userId: 'account-a' }));

    await waitFor(() => expect(registerPushMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(pushTokenListener).not.toBeNull());

    act(() => {
      pushTokenListener?.({ data: 'native-token-2', type: 'android' });
    });

    await act(async () => {
      firstRegistration.resolve('ExponentPushToken[before-rotation]');
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(registerPushMock).toHaveBeenCalledTimes(2));
    expect(registerDeviceTokenMock).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('revokes a registration that completes after the controller logs out', async () => {
    const registration = createDeferred<string>();
    registerPushMock.mockReturnValueOnce(registration.promise);
    const { usePushRegistration } = await import(
      '@/mobile/app/app-shell/notifications/usePushRegistration'
    );
    const hook = renderHook(() => usePushRegistration({ booted: true, userId: 'account-a' }));

    await waitFor(() => expect(registerPushMock).toHaveBeenCalledOnce());
    hook.unmount();

    registration.resolve('ExponentPushToken[stale]');
    await flushEffects();

    expect(prepareCleanupMock).toHaveBeenCalledWith('ExponentPushToken[stale]');
    expect(flushCleanupMock).toHaveBeenCalledTimes(2);
    expect(unsubscribeOnlineMock).toHaveBeenCalledOnce();
  });
});
