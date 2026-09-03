import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

describe('systemPushBackgroundHandler', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  it('shows one generic local notification for an idempotent data-only message', async () => {
    const scheduleMinimalDataNotification = vi.fn().mockResolvedValue(undefined);
    const handler = await import('@/mobile/app/platform/notifications/systemPushBackgroundHandler');

    await expect(handler.handleSystemPushBackgroundMessage(
      { data: { privateBody: 'must-not-be-copied' }, messageId: 'fcm-message-1' },
      { scheduleMinimalDataNotification, storage },
    )).resolves.toBe(true);

    expect(scheduleMinimalDataNotification).toHaveBeenCalledOnce();
    const persistedMarkers = JSON.parse(String(storage.setItem.mock.calls[0]?.[1])) as string[];
    expect(persistedMarkers).toHaveLength(1);
    expect(persistedMarkers[0]).not.toContain('fcm-message-1');
    expect(String(storage.setItem.mock.calls[0]?.[1])).not.toContain('privateBody');
  });

  it('does not duplicate a previously handled data-only message or mirror notification payloads', async () => {
    const handler = await import('@/mobile/app/platform/notifications/systemPushBackgroundHandler');
    const marker = handler.systemPushBackgroundHandlerInternals.opaqueMessageMarker('same-message');
    storage.getItem.mockResolvedValue(JSON.stringify([marker]));
    const scheduleMinimalDataNotification = vi.fn();

    await expect(handler.handleSystemPushBackgroundMessage(
      { data: { ignored: 'payload' }, messageId: 'same-message' },
      { scheduleMinimalDataNotification, storage },
    )).resolves.toBe(false);
    await expect(handler.handleSystemPushBackgroundMessage(
      {
        data: { ignored: 'payload' },
        messageId: 'new-message',
        notification: { body: 'OS owns this', title: 'Remote' },
      },
      { scheduleMinimalDataNotification, storage },
    )).resolves.toBe(false);

    expect(scheduleMinimalDataNotification).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('serializes concurrent duplicate deliveries and schedules only once', async () => {
    let persisted: string | null = null;
    const statefulStorage = {
      getItem: vi.fn(async () => persisted),
      setItem: vi.fn(async (_key: string, value: string) => {
        persisted = value;
      }),
    };
    const scheduleMinimalDataNotification = vi.fn().mockResolvedValue(undefined);
    const handler = await import('@/mobile/app/platform/notifications/systemPushBackgroundHandler');
    handler.systemPushBackgroundHandlerInternals.resetRegistrationForTests();
    const message = { data: { ignored: 'payload' }, messageId: 'concurrent-message' };

    await expect(Promise.all([
      handler.handleSystemPushBackgroundMessage(message, {
        scheduleMinimalDataNotification,
        storage: statefulStorage,
      }),
      handler.handleSystemPushBackgroundMessage(message, {
        scheduleMinimalDataNotification,
        storage: statefulStorage,
      }),
    ])).resolves.toEqual([true, false]);

    expect(scheduleMinimalDataNotification).toHaveBeenCalledOnce();
  });

  it('does not persist a dedupe marker when notification scheduling fails', async () => {
    const scheduleMinimalDataNotification = vi.fn()
      .mockRejectedValueOnce(new Error('os scheduling failed'))
      .mockResolvedValueOnce(undefined);
    const handler = await import('@/mobile/app/platform/notifications/systemPushBackgroundHandler');
    handler.systemPushBackgroundHandlerInternals.resetRegistrationForTests();
    const message = { data: {}, messageId: 'retryable-message' };

    await expect(handler.handleSystemPushBackgroundMessage(message, {
      scheduleMinimalDataNotification,
      storage,
    })).rejects.toThrow('os scheduling failed');
    expect(storage.setItem).not.toHaveBeenCalled();

    await expect(handler.handleSystemPushBackgroundMessage(message, {
      scheduleMinimalDataNotification,
      storage,
    })).resolves.toBe(true);
    expect(scheduleMinimalDataNotification).toHaveBeenCalledTimes(2);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it('registers the FCM background handler only once and contains handler failures', async () => {
    const setBackgroundMessageHandler = vi.fn();
    const messageHandler = vi.fn().mockRejectedValue(new Error('provider payload must stay private'));
    const handler = await import('@/mobile/app/platform/notifications/systemPushBackgroundHandler');
    handler.systemPushBackgroundHandlerInternals.resetRegistrationForTests();
    const getFirebaseMessagingModule = vi.fn(() => ({
      getMessaging: () => ({ id: 'messaging' }),
      setBackgroundMessageHandler,
    }));

    expect(handler.registerSystemPushBackgroundHandler({ getFirebaseMessagingModule, handleMessage: messageHandler })).toBe(true);
    expect(handler.registerSystemPushBackgroundHandler({ getFirebaseMessagingModule, handleMessage: messageHandler })).toBe(true);
    expect(setBackgroundMessageHandler).toHaveBeenCalledOnce();

    const callback = setBackgroundMessageHandler.mock.calls[0]?.[1] as (message: unknown) => Promise<void>;
    await expect(callback({ messageId: 'fcm-message-2' })).resolves.toBeUndefined();
  });

  it('fails closed when the native Firebase module is unavailable', async () => {
    const handler = await import('@/mobile/app/platform/notifications/systemPushBackgroundHandler');
    handler.systemPushBackgroundHandlerInternals.resetRegistrationForTests();

    expect(handler.registerSystemPushBackgroundHandler({
      getFirebaseMessagingModule: () => { throw new Error('native module unavailable'); },
      handleMessage: vi.fn(),
    })).toBe(false);
  });
});
