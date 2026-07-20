import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, limitMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: { from: fromMock },
}));

import {
  fetchOwnedMapMarkers,
  mapMarkersRepositoryInternals,
} from '@/mobile/app/data/repositories/mapMarkersRepository';

function arrangeResponse(response: unknown) {
  const builder = {
    eq: vi.fn(),
    limit: limitMock,
    order: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  limitMock.mockReturnValueOnce(builder).mockResolvedValueOnce(response);
  fromMock.mockReturnValue(builder);
  return builder;
}

describe('mapMarkersRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    limitMock.mockReset();
  });

  it('aggregates duplicate coordinates and keeps the newest place label', async () => {
    const builder = arrangeResponse({
      data: [
        {
          is_public: false,
          list_places: [
            { lat: 41, lng: 29, name: 'Older', updated_at: '2026-01-01T00:00:00.000Z' },
            { lat: 40, lng: 28, name: 'Second', updated_at: '2026-01-01T00:00:00.000Z' },
          ],
        },
        {
          is_public: true,
          list_places: [
            { lat: 41, lng: 29, name: 'Newest', updated_at: '2026-02-01T00:00:00.000Z' },
          ],
        },
        { is_public: true, list_places: null },
      ],
      error: null,
    });

    const markers = await fetchOwnedMapMarkers('viewer-1');

    expect(fromMock).toHaveBeenCalledWith('lists');
    expect(builder.eq).toHaveBeenCalledWith('owner_id', 'viewer-1');
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(limitMock).toHaveBeenNthCalledWith(1, mapMarkersRepositoryInternals.MAP_LIST_LIMIT);
    expect(limitMock).toHaveBeenNthCalledWith(2, mapMarkersRepositoryInternals.MAP_PLACES_PER_LIST_LIMIT, {
      foreignTable: 'list_places!list_places_list_id_fkey',
    });
    expect(markers).toHaveLength(2);
    expect(markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        lat: 41,
        lng: 29,
        markerKind: 'saved',
        markerVisibility: 'mixed',
        name: 'Newest',
      }),
      expect.objectContaining({
        lat: 40,
        lng: 28,
        markerVisibility: 'private',
        name: 'Second',
      }),
    ]));
  });

  it('keeps the existing label for older duplicates and handles empty data', async () => {
    arrangeResponse({
      data: [{
        is_public: true,
        list_places: [
          { lat: 41, lng: 29, name: 'Current', updated_at: '2026-02-01T00:00:00.000Z' },
          { lat: 41, lng: 29, name: 'Older', updated_at: '2026-01-01T00:00:00.000Z' },
        ],
      }],
      error: null,
    });
    await expect(fetchOwnedMapMarkers('viewer-1')).resolves.toEqual([
      expect.objectContaining({ name: 'Current', markerVisibility: 'public' }),
    ]);

    arrangeResponse({ data: null, error: null });
    await expect(fetchOwnedMapMarkers('viewer-1')).resolves.toEqual([]);
  });

  it('propagates query failures', async () => {
    const error = new Error('map markers failed');
    arrangeResponse({ data: null, error });
    await expect(fetchOwnedMapMarkers('viewer-1')).rejects.toThrow(error);
  });
});
