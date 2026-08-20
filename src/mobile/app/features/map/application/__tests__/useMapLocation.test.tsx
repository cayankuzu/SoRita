import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

const getCurrentPositionAsyncMock = vi.fn();
const requestForegroundPermissionsAsyncMock = vi.fn();
const reverseGeocodeAsyncMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('expo-location', () => ({
  Accuracy: { Balanced: 'balanced' },
  getCurrentPositionAsync: getCurrentPositionAsyncMock,
  requestForegroundPermissionsAsync: requestForegroundPermissionsAsyncMock,
  reverseGeocodeAsync: reverseGeocodeAsyncMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

describe('useMapLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes non-Error location failures', async () => {
    getCurrentPositionAsyncMock.mockRejectedValue('gps unavailable');
    const { mapLocationInternals } = await import(
      '@/mobile/app/features/map/application/useMapLocation'
    );

    await expect(mapLocationInternals.getCurrentLocationWithTimeout()).rejects.toThrow(
      'gps unavailable',
    );
  });

  it('handles silent permission and provider failures without a toast', async () => {
    const { useMapLocation } = await import(
      '@/mobile/app/features/map/application/useMapLocation'
    );
    requestForegroundPermissionsAsyncMock.mockResolvedValueOnce({
      canAskAgain: false,
      status: 'denied',
    });
    const hook = renderHook(() => useMapLocation());

    await act(async () => hook.result.current.locate());
    expect(hook.result.current.locationPermissionDenied).toBe(true);
    expect(hook.result.current.locationPermissionCanAskAgain).toBe(false);
    expect(showToastMock).not.toHaveBeenCalled();

    requestForegroundPermissionsAsyncMock.mockResolvedValueOnce({
      canAskAgain: true,
      status: 'granted',
    });
    getCurrentPositionAsyncMock.mockRejectedValueOnce(new Error('provider failed'));
    await act(async () => hook.result.current.locate());
    expect(hook.result.current.locationErrorMessage).toBeTruthy();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('formats a resolved address and handles empty geocoder results', async () => {
    const { useMapLocation } = await import(
      '@/mobile/app/features/map/application/useMapLocation'
    );
    const hook = renderHook(() => useMapLocation());
    reverseGeocodeAsyncMock.mockResolvedValueOnce([{
      city: 'İstanbul',
      district: 'Kadıköy',
      street: 'Moda Caddesi',
      streetNumber: '1',
    }]);
    await expect(hook.result.current.resolveAddress(41, 29)).resolves.toBe(
      'Moda Caddesi 1, Kadıköy, İstanbul',
    );

    reverseGeocodeAsyncMock.mockResolvedValueOnce([]);
    await expect(hook.result.current.resolveAddress(41, 29)).resolves.toBeUndefined();
  });
});
