import { beforeEach, describe, expect, it, vi } from 'vitest';

const callJsonEdgeFunctionMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@/mobile/app/platform/api/edgeFunctions', () => ({
  callJsonEdgeFunction: callJsonEdgeFunctionMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    supabaseMapsFunctionName: 'maps-geocoding',
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

describe('platform/api/geocoding', () => {
  beforeEach(() => {
    callJsonEdgeFunctionMock.mockReset();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
      error: null,
    });
  });

  it('uses the authenticated edge function for text search', async () => {
    const results = [
      {
        address: 'Ankara, Turkiye',
        lat: 39.93,
        lng: 32.85,
        name: 'Kizilay',
        placeId: 'place-1',
      },
    ];
    callJsonEdgeFunctionMock.mockResolvedValue({ results });

    const { searchPlacesByText } = await import('@/mobile/app/platform/api/geocoding');
    await expect(searchPlacesByText(' Kizilay ')).resolves.toEqual(results);
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith(
      'maps-geocoding',
      { action: 'search', query: 'Kizilay' },
      { accessToken: 'session-token' },
    );
  });

  it('does not call the network for a blank text search', async () => {
    const { searchPlacesByText } = await import('@/mobile/app/platform/api/geocoding');
    await expect(searchPlacesByText('   ')).resolves.toEqual([]);
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(callJsonEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it('uses the authenticated edge function for reverse geocoding', async () => {
    const result = {
      address: 'Kizilay, Ankara, Turkiye',
      isPointOfInterest: true,
      lat: 39.92,
      lng: 32.85,
      name: 'Kizilay',
    };
    callJsonEdgeFunctionMock.mockResolvedValue({ result });

    const { reverseGeocodeLocation } = await import('@/mobile/app/platform/api/geocoding');
    await expect(reverseGeocodeLocation(39.92, 32.85)).resolves.toEqual(result);
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith(
      'maps-geocoding',
      { action: 'reverse', latitude: 39.92, longitude: 32.85 },
      { accessToken: 'session-token' },
    );
  });

  it('propagates edge failures instead of exposing a client-side service-key fallback', async () => {
    const edgeError = new Error('Harita servisi su anda kullanilamiyor.');
    callJsonEdgeFunctionMock.mockRejectedValue(edgeError);

    const { searchPlacesByText } = await import('@/mobile/app/platform/api/geocoding');
    await expect(searchPlacesByText('Kizilay')).rejects.toBe(edgeError);
  });

  it('rejects missing and failed sessions before calling the edge function', async () => {
    const { searchPlacesByText } = await import('@/mobile/app/platform/api/geocoding');

    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    await expect(searchPlacesByText('Kizilay')).rejects.toThrow();

    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('session read failed'),
    });
    await expect(searchPlacesByText('Kizilay')).rejects.toThrow('session read failed');
    expect(callJsonEdgeFunctionMock).not.toHaveBeenCalled();
  });
});
