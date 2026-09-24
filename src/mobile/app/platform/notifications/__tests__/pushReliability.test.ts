import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({
  OS: 'android' as 'android' | 'ios',
  constants: {} as { Brand?: string; Manufacturer?: string },
}));
const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('react-native', () => ({ Platform: platform }));
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
} from '@/mobile/app/platform/notifications/pushReliability';

describe('pushReliability', () => {
  beforeEach(() => {
    platform.OS = 'android';
    platform.constants = {};
    storage.clear();
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
