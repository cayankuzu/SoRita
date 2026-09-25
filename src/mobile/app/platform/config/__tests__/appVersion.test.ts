import { beforeEach, describe, expect, it, vi } from 'vitest';

const application = vi.hoisted(() => ({
  nativeApplicationVersion: null as string | null,
  nativeBuildVersion: null as string | null,
}));

vi.mock('expo-application', () => application);

import { getInstalledAppVersionLabel } from '@/mobile/app/platform/config/appVersion';

describe('getInstalledAppVersionLabel', () => {
  beforeEach(() => {
    application.nativeApplicationVersion = null;
    application.nativeBuildVersion = null;
  });

  it('reads the installed version and build', () => {
    application.nativeApplicationVersion = '1.0.110';
    application.nativeBuildVersion = '116';
    expect(getInstalledAppVersionLabel()).toBe('1.0.110 (116)');

    application.nativeBuildVersion = null;
    expect(getInstalledAppVersionLabel()).toBe('1.0.110');
  });

  it('shows nothing where the native values are missing', () => {
    expect(getInstalledAppVersionLabel()).toBeNull();
  });
});
