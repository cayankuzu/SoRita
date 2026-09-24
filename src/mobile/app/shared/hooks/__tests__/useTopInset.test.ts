import { beforeEach, describe, expect, it, vi } from 'vitest';

const safeArea = vi.hoisted(() => ({
  initialWindowMetrics: null as null | { insets: { top: number } },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
}));

vi.mock('react-native-safe-area-context', () => ({
  get initialWindowMetrics() {
    return safeArea.initialWindowMetrics;
  },
  useSafeAreaInsets: () => safeArea.insets,
}));

import { useTopInset } from '@/mobile/app/shared/hooks/useTopInset';
import { renderHook } from '@/mobile/app/test/hookTestUtils';

describe('useTopInset', () => {
  beforeEach(() => {
    safeArea.initialWindowMetrics = null;
    safeArea.insets = { bottom: 0, left: 0, right: 0, top: 0 };
  });

  it('clears the status bar on the first frame, before the provider has measured', () => {
    safeArea.initialWindowMetrics = { insets: { top: 32 } };
    expect(renderHook(() => useTopInset()).result.current).toBe(32);
  });

  it('follows the measured inset, and is zero only where there is no status bar', () => {
    safeArea.insets = { bottom: 0, left: 0, right: 0, top: 44 };
    expect(renderHook(() => useTopInset()).result.current).toBe(44);

    safeArea.insets = { bottom: 0, left: 0, right: 0, top: 0 };
    expect(renderHook(() => useTopInset()).result.current).toBe(0);
  });
});
