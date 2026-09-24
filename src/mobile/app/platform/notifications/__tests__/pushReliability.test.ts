import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({
  OS: 'android' as 'android' | 'ios',
  constants: {} as { Brand?: string; Manufacturer?: string },
}));
const storage = vi.hoisted(() => new Map<string, string>());
const linking = vi.hoisted(() => ({
  openSettings: vi.fn(async () => undefined),
  sendIntent: vi.fn(async () => undefined),
}));

vi.mock('react-native', () => ({ Linking: linking, Platform: platform }));
vi.mock('expo-application', () => ({ applicationId: 'com.cayan.sorita.socialmap' }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

import {
  dismissBackgroundDeliveryTip,
  getRestrictiveMakerName,
  isBackgroundDeliveryTipDismissed,
  openAppNotificationSettings,
} from '@/mobile/app/platform/notifications/pushReliability';

describe('pushReliability', () => {
  beforeEach(() => {
    platform.OS = 'android';
    platform.constants = {};
    storage.clear();
    linking.openSettings.mockClear();
    linking.sendIntent.mockReset();
    linking.sendIntent.mockResolvedValue(undefined);
  });

  it('opens the push channel page, where MIUI keeps on-screen and lock screen switches', async () => {
    await openAppNotificationSettings();
    expect(linking.sendIntent).toHaveBeenCalledTimes(1);
    expect(linking.sendIntent).toHaveBeenCalledWith('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.cayan.sorita.socialmap' },
      { key: 'android.provider.extra.CHANNEL_ID', value: 'sorita-alerts-v5' },
    ]);
    expect(linking.openSettings).not.toHaveBeenCalled();
  });

  it('falls back to the app notification page, then the app page, and on iOS', async () => {
    linking.sendIntent.mockRejectedValueOnce(new Error('no channel page'));
    await openAppNotificationSettings();
    expect(linking.sendIntent).toHaveBeenLastCalledWith('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.cayan.sorita.socialmap' },
    ]);
    expect(linking.openSettings).not.toHaveBeenCalled();

    linking.sendIntent.mockRejectedValue(new Error('no activity'));
    await openAppNotificationSettings();
    expect(linking.openSettings).toHaveBeenCalledTimes(1);

    platform.OS = 'ios';
    await openAppNotificationSettings();
    expect(linking.openSettings).toHaveBeenCalledTimes(2);
  });

  it('names the makers that stop swiped-away apps, by manufacturer or brand', () => {
    platform.constants = { Manufacturer: 'Xiaomi', Brand: 'Redmi' };
    expect(getRestrictiveMakerName()).toBe('Xiaomi');

    platform.constants = { Manufacturer: 'unknown', Brand: 'POCO' };
    expect(getRestrictiveMakerName()).toBe('Xiaomi');

    platform.constants = { Manufacturer: 'OPPO' };
    expect(getRestrictiveMakerName()).toBe('OPPO');
  });

  it('stays quiet on phones that deliver to closed apps, and on iOS', () => {
    platform.constants = { Manufacturer: 'Google', Brand: 'google' };
    expect(getRestrictiveMakerName()).toBeNull();

    platform.constants = { Manufacturer: 'samsung' };
    expect(getRestrictiveMakerName()).toBeNull();

    platform.OS = 'ios';
    platform.constants = { Manufacturer: 'Xiaomi' };
    expect(getRestrictiveMakerName()).toBeNull();
  });

  it('remembers that the tip was dismissed', async () => {
    await expect(isBackgroundDeliveryTipDismissed()).resolves.toBe(false);
    await dismissBackgroundDeliveryTip();
    await expect(isBackgroundDeliveryTipDismissed()).resolves.toBe(true);
  });
});
