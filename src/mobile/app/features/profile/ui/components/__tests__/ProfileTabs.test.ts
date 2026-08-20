import { describe, expect, it } from 'vitest';

import { shouldUseCompactProfileTabs } from '@/mobile/app/features/profile/ui/components/profileTabsLayout';

describe('ProfileTabs responsive mode', () => {
  it.each([320, 360])('uses the collision-safe compact mode at %idp', (width) => {
    expect(shouldUseCompactProfileTabs(width, 1)).toBe(true);
  });

  it.each([390, 411, 480])('keeps the regular mode at %idp and 100%% text', (width) => {
    expect(shouldUseCompactProfileTabs(width, 1)).toBe(false);
  });

  it.each([1.3, 1.5, 2])('uses compact mode at %sx text on wider phones', (fontScale) => {
    expect(shouldUseCompactProfileTabs(480, fontScale)).toBe(true);
  });
});
