import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ OS: 'android' as 'android' | 'ios' }));
const setNotificationHandlerMock = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('expo-notifications', () => ({
  AndroidNotificationPriority: { MAX: 'max' },
  setNotificationHandler: setNotificationHandlerMock,
}));
vi.mock('@/mobile/app/platform/notifications/androidPushChannel', () => ({
  ensureAndroidPushChannel: vi.fn(async () => undefined),
}));
vi.mock('@/mobile/app/platform/notifications/runtime', () => ({
  notificationRuntime: { supportsNotificationObservers: true },
}));

import {
  ensureForegroundNotificationPresentation,
  foregroundNotificationPresentationInternals,
} from '@/mobile/app/platform/notifications/foregroundNotificationPresentation';
import {
  claimForegroundPushes,
  inAppPushBannerInternals,
  showInAppPushBanner,
  showsForegroundPushesInApp,
  subscribeToInAppPushBanners,
} from '@/mobile/app/platform/notifications/inAppPushBanner';

async function presentationFor() {
  const [[handler]] = setNotificationHandlerMock.mock.calls as Array<
    [{ handleNotification: () => Promise<Record<string, unknown>> }]
  >;
  return handler.handleNotification();
}

describe('in-app push banner', () => {
  beforeEach(async () => {
    platform.OS = 'android';
    inAppPushBannerInternals.reset();
    setNotificationHandlerMock.mockReset();
    foregroundNotificationPresentationInternals.resetForTests();
    await ensureForegroundNotificationPresentation();
  });

  it('takes over only once a banner host and a signed-in receiver are both up', () => {
    expect(showsForegroundPushesInApp()).toBe(false);

    const unsubscribe = subscribeToInAppPushBanners(vi.fn());
    expect(showsForegroundPushesInApp()).toBe(false);

    const release = claimForegroundPushes();
    expect(showsForegroundPushesInApp()).toBe(true);

    release();
    release();
    expect(showsForegroundPushesInApp()).toBe(false);
    unsubscribe();
  });

  it('hands each push to every mounted host', () => {
    const host = vi.fn();
    const unsubscribe = subscribeToInAppPushBanners(host);
    const banner = { body: 'listeni beğendi', id: 'push-1', onPress: vi.fn(), title: 'Ayşe' };

    showInAppPushBanner(banner);
    expect(host).toHaveBeenCalledWith(banner);

    unsubscribe();
    showInAppPushBanner(banner);
    expect(host).toHaveBeenCalledTimes(1);
  });

  it('keeps the system banner while the app cannot show its own', async () => {
    await expect(presentationFor()).resolves.toMatchObject({
      shouldPlaySound: true,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  it('shows no system banner over its own, and keeps the iPhone list entry', async () => {
    subscribeToInAppPushBanners(vi.fn());
    claimForegroundPushes();

    await expect(presentationFor()).resolves.toMatchObject({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: false,
      shouldShowList: false,
    });

    platform.OS = 'ios';
    await expect(presentationFor()).resolves.toMatchObject({
      shouldShowBanner: false,
      shouldShowList: true,
    });
  });
});
