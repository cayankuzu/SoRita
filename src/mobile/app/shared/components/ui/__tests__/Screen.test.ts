import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-navigation/bottom-tabs', () => ({
  BottomTabBarHeightContext: React.createContext<number | null>(null),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

import { getScreenBottomPadding } from '@/mobile/app/shared/components/ui/Screen';
import { spacing } from '@/mobile/app/shared/theme/tokens';

describe('getScreenBottomPadding', () => {
  it('does not reserve the bottom tab bar twice inside tab screens', () => {
    expect(getScreenBottomPadding(true, 72, 24)).toBe(0);
  });

  it('uses the safe-area inset outside the tab navigator', () => {
    expect(getScreenBottomPadding(true, null, 24)).toBe(24 + spacing.card);
  });

  it('allows full-bleed screens to opt out', () => {
    expect(getScreenBottomPadding(false, 72, 24)).toBe(0);
  });
});
