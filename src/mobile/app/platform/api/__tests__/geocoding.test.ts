import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const callJsonEdgeFunctionMock = vi.fn();
const isEdgeFunctionErrorMock = vi.fn();
const isMissingEdgeFunctionErrorMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@/mobile/app/platform/api/edgeFunctions', () => ({
  callJsonEdgeFunction: callJsonEdgeFunctionMock,
  isEdgeFunctionError: isEdgeFunctionErrorMock,
  isMissingEdgeFunctionError: isMissingEdgeFunctionErrorMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    googleMapsServicesApiKey: 'services-key',
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

const server = setupServer();

describe('platform/api/geocoding', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  beforeEach(() => {
    callJsonEdgeFunctionMock.mockReset();
    isEdgeFunctionErrorMock.mockReset();
    isMissingEdgeFunctionErrorMock.mockReset();
    getSessionMock.mockReset();
    isEdgeFunctionErrorMock.mockReturnValue(false);
    isMissingEdgeFunctionErrorMock.mockReturnValue(false);
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
      error: null,
    });
  });

  it('uses the deployed edge function when available', async () => {
    callJsonEdgeFunctionMock.mockResolvedValue({
      results: [
        {
          address: 'Ankara, Turkiye',
          lat: 39.93,
          lng: 32.85,
          name: 'Kizilay',
          placeId: 'place-1',
        },
      ],
    });

    const { searchPlacesByText } = await import('@/mobile/app/platform/api/geocoding');
    await expect(searchPlacesByText(' Kizilay ')).resolves.toEqual([
      {
        address: 'Ankara, Turkiye',
        lat: 39.93,
        lng: 32.85,
        name: 'Kizilay',
        placeId: 'place-1',
      },
    ]);

    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith(
      'maps-geocoding',
      {
        action: 'search',
        query: 'Kizilay',
      },
      {
        accessToken: 'session-token',
      },
    );
  });

  it('falls back to Google services search when the edge function is missing', async () => {
    const missingFunctionError = new Error('Requested function was not found');
    callJsonEdgeFunctionMock.mockRejectedValue(missingFunctionError);
    isMissingEdgeFunctionErrorMock.mockReturnValue(true);

    server.use(
      http.post('https://places.googleapis.com/v1/places:searchText', async () =>
        HttpResponse.json({
          places: [
            {
              displayName: { text: 'Kizilay Meydani' },
              formattedAddress: 'Kizilay Meydani, Ankara, Turkiye',
              id: 'places-1',
              location: { latitude: 39.92, longitude: 32.85 },
            },
          ],
        }),
      ),
      http.get('https://maps.googleapis.com/maps/api/geocode/json', async () =>
        HttpResponse.json({
          results: [
            {
              formatted_address: 'Kizilay, Ankara, Turkiye',
              geometry: {
                location: {
                  lat: 39.921,
                  lng: 32.854,
                },
              },
              place_id: 'geo-1',
            },
          ],
          status: 'OK',
        }),
      ),
    );

    const { searchPlacesByText } = await import('@/mobile/app/platform/api/geocoding');
    await expect(searchPlacesByText('Kizilay')).resolves.toEqual([
      {
        address: 'Kizilay, Ankara, Turkiye',
        lat: 39.921,
        lng: 32.854,
        name: 'Kizilay',
        placeId: 'geo-1',
      },
      {
        address: 'Kizilay Meydani, Ankara, Turkiye',
        lat: 39.92,
        lng: 32.85,
        name: 'Kizilay Meydani',
        placeId: 'places-1',
      },
    ]);
  });

  it('falls back to Google services search when the edge function returns a server error', async () => {
    callJsonEdgeFunctionMock.mockRejectedValue({
      message: 'Harita servisi su anda kullanilamiyor.',
      status: 500,
    });
    isEdgeFunctionErrorMock.mockReturnValue(true);

    server.use(
      http.post('https://places.googleapis.com/v1/places:searchText', async () =>
        HttpResponse.json({
          places: [
            {
              displayName: { text: 'Karga' },
              formattedAddress: 'Caferaga, Kadife Sk. No:16, Kadikoy/Istanbul, Turkiye',
              id: 'places-1',
              location: { latitude: 40.9866119, longitude: 29.0265598 },
            },
          ],
        }),
      ),
      http.get('https://maps.googleapis.com/maps/api/geocode/json', async () =>
        HttpResponse.json({
          results: [],
          status: 'ZERO_RESULTS',
        }),
      ),
    );

    const { searchPlacesByText } = await import('@/mobile/app/platform/api/geocoding');
    await expect(searchPlacesByText('Karga')).resolves.toEqual([
      {
        address: 'Caferaga, Kadife Sk. No:16, Kadikoy/Istanbul, Turkiye',
        lat: 40.9866119,
        lng: 29.0265598,
        name: 'Karga',
        placeId: 'places-1',
      },
    ]);
  });

  it('falls back to Google services reverse geocoding when the edge function is missing', async () => {
    const missingFunctionError = new Error('Requested function was not found');
    callJsonEdgeFunctionMock.mockRejectedValue(missingFunctionError);
    isMissingEdgeFunctionErrorMock.mockReturnValue(true);

    server.use(
      http.get('https://maps.googleapis.com/maps/api/geocode/json', async () =>
        HttpResponse.json({
          results: [
            {
              formatted_address: 'Kizilay, Ankara, Turkiye',
              geometry: {
                location: {
                  lat: 39.92,
                  lng: 32.85,
                },
              },
              types: ['point_of_interest', 'establishment'],
              address_components: [
                {
                  long_name: 'Kizilay',
                  types: ['point_of_interest'],
                },
              ],
            },
          ],
          status: 'OK',
        }),
      ),
    );

    const { reverseGeocodeLocation } = await import('@/mobile/app/platform/api/geocoding');
    await expect(reverseGeocodeLocation(39.92, 32.85)).resolves.toEqual({
      address: 'Kizilay, Ankara, Turkiye',
      isPointOfInterest: true,
      lat: 39.92,
      lng: 32.85,
      name: 'Kizilay',
    });
  });

  it('falls back to Google services reverse geocoding when the edge function returns a server error', async () => {
    callJsonEdgeFunctionMock.mockRejectedValue({
      message: 'Harita istegi tamamlanamadi.',
      status: 500,
    });
    isEdgeFunctionErrorMock.mockReturnValue(true);

    server.use(
      http.get('https://maps.googleapis.com/maps/api/geocode/json', async () =>
        HttpResponse.json({
          results: [
            {
              formatted_address: 'Caferaga, Kadikoy/Istanbul, Turkiye',
              geometry: {
                location: {
                  lat: 40.9866119,
                  lng: 29.0265598,
                },
              },
              types: ['point_of_interest', 'establishment'],
              address_components: [
                {
                  long_name: 'Karga',
                  types: ['point_of_interest'],
                },
              ],
            },
          ],
          status: 'OK',
        }),
      ),
    );

    const { reverseGeocodeLocation } = await import('@/mobile/app/platform/api/geocoding');
    await expect(reverseGeocodeLocation(40.9866119, 29.0265598)).resolves.toEqual({
      address: 'Caferaga, Kadikoy/Istanbul, Turkiye',
      isPointOfInterest: true,
      lat: 40.9866119,
      lng: 29.0265598,
      name: 'Karga',
    });
  });
});
