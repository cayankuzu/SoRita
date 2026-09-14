import { AppState, Platform } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPermissionsAsyncMock = vi.fn();
const requestPermissionsAsyncMock = vi.fn();

vi.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  getPermissionsAsync: getPermissionsAsyncMock,
  requestPermissionsAsync: requestPermissionsAsyncMock,
}));

function setAppState(state: 'active' | 'background' | 'inactive' | 'unknown' | null) {
  (AppState as unknown as { currentState: typeof state }).currentState = state;
}

describe('pushPermission', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    Platform.OS = 'android';
    setAppState('active');
    getPermissionsAsyncMock.mockResolvedValue({
      canAskAgain: true,
      granted: false,
      status: 'undetermined',
    });
    requestPermissionsAsyncMock.mockResolvedValue({
      canAskAgain: true,
      granted: true,
      status: 'granted',
    });

    const { pushPermissionInternals } = await import(
      '@/mobile/app/platform/notifications/pushPermission'
    );
    pushPermissionInternals.resetForTests();
  });

  it('shares one Android permission prompt across concurrent registration paths', async () => {
    const { resolvePushPermission } = await import(
      '@/mobile/app/platform/notifications/pushPermission'
    );

    await expect(Promise.all([
      resolvePushPermission({ requestIfPossible: true }),
      resolvePushPermission({ requestIfPossible: true }),
    ])).resolves.toEqual([
      { allowsInterruptions: true, canAskAgain: true, granted: true },
      { allowsInterruptions: true, canAskAgain: true, granted: true },
    ]);

    expect(requestPermissionsAsyncMock).toHaveBeenCalledOnce();
    expect(requestPermissionsAsyncMock).toHaveBeenCalledWith(undefined);
  });

  it('does not repeatedly prompt after the user declines in the same process', async () => {
    requestPermissionsAsyncMock.mockResolvedValue({
      canAskAgain: true,
      granted: false,
      status: 'denied',
    });
    const { resolvePushPermission } = await import(
      '@/mobile/app/platform/notifications/pushPermission'
    );

    await expect(resolvePushPermission({ requestIfPossible: true })).resolves.toMatchObject({
      granted: false,
    });
    await expect(resolvePushPermission({ requestIfPossible: true })).resolves.toMatchObject({
      granted: false,
    });

    expect(requestPermissionsAsyncMock).toHaveBeenCalledOnce();
  });

  it.each(['background', 'inactive', 'unknown', null] as const)(
    'never opens an OS prompt unless AppState is definitely active (%s)',
    async (state) => {
      const { resolvePushPermission } = await import(
        '@/mobile/app/platform/notifications/pushPermission'
      );

      setAppState(state);
      await expect(resolvePushPermission({ requestIfPossible: true })).resolves.toMatchObject({
        granted: false,
      });

      expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
    },
  );

  it('never opens an OS prompt when the permission state is blocked', async () => {
    const { resolvePushPermission } = await import(
      '@/mobile/app/platform/notifications/pushPermission'
    );

    getPermissionsAsyncMock.mockResolvedValue({
      canAskAgain: false,
      granted: false,
      status: 'denied',
    });
    await expect(resolvePushPermission({ requestIfPossible: true })).resolves.toMatchObject({
      granted: false,
    });

    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
  });

  it.each([
    ['authorized', 2, true, true],
    ['provisional', 3, true, false],
    ['ephemeral', 4, true, false],
    ['denied', 1, false, false],
  ])(
    'uses the iOS %s status when the root granted flag disagrees',
    async (_label, status, granted, allowsInterruptions) => {
      Platform.OS = 'ios';
      getPermissionsAsyncMock.mockResolvedValue({
        canAskAgain: false,
        granted: status === 1,
        ios: {
          allowsAlert: true,
          allowsDisplayInNotificationCenter: true,
          allowsDisplayOnLockScreen: true,
          allowsSound: true,
          status,
        },
      });
      const { resolvePushPermission } = await import(
        '@/mobile/app/platform/notifications/pushPermission'
      );

      await expect(resolvePushPermission()).resolves.toEqual({
        allowsInterruptions,
        canAskAgain: false,
        granted,
      });
    },
  );

  it('requests alert, badge, and sound together on iOS', async () => {
    Platform.OS = 'ios';
    requestPermissionsAsyncMock.mockResolvedValue({
      canAskAgain: true,
      granted: false,
      ios: {
        allowsAlert: true,
        allowsDisplayInNotificationCenter: true,
        allowsDisplayOnLockScreen: true,
        allowsSound: true,
        status: 2,
      },
    });
    const { resolvePushPermission } = await import(
      '@/mobile/app/platform/notifications/pushPermission'
    );

    await expect(resolvePushPermission({ requestIfPossible: true })).resolves.toMatchObject({
      granted: true,
    });
    expect(requestPermissionsAsyncMock).toHaveBeenCalledWith({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  });
});
