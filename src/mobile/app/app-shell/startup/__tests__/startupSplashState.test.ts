import { describe, expect, it } from 'vitest';

import { shouldShowStartupSplash } from '@/mobile/app/app-shell/startup/startupSplashState';

describe('shouldShowStartupSplash', () => {
  it('keeps the splash only until auth boot and the first shell are ready', () => {
    expect(shouldShowStartupSplash({ booted: false, shellReady: false })).toBe(true);
    expect(shouldShowStartupSplash({ booted: true, shellReady: false })).toBe(true);
    expect(shouldShowStartupSplash({ booted: true, shellReady: true })).toBe(false);
  });
});
