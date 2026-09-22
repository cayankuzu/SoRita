import { describe, expect, it } from 'vitest';

import { getListMarkerColor, getMapMarkers } from '@/mobile/app/shared/utils/markerColors';

const place = (lat: number, lng: number, name = 'Mekân') => ({ lat, lng, name });

describe('getMapMarkers', () => {
  it('keeps a real coordinate and carries the list colour', () => {
    const markers = getMapMarkers([place(39.781299, 30.513112, 'Zeyn Coffee')], true);

    expect(markers).toEqual([
      {
        lat: 39.781299,
        lng: 30.513112,
        name: 'Zeyn Coffee',
        markerColor: getListMarkerColor(true),
      },
    ]);
  });

  // The defect this closes: an unvalidated 0,0 asked Static Maps for open
  // water in the Gulf of Guinea, and the card rendered a blank blue rectangle
  // with a pin as though that were the place.
  it('drops the 0,0 pair an unset column leaves behind', () => {
    expect(getMapMarkers([place(0, 0)], true)).toEqual([]);
  });

  it('keeps a genuine coordinate that merely has one zero component', () => {
    expect(getMapMarkers([place(0, 30.5)], true)).toHaveLength(1);
    expect(getMapMarkers([place(39.7, 0)], true)).toHaveLength(1);
  });

  it.each([
    ['latitude past the pole', place(91, 30)],
    ['longitude past the antimeridian', place(39, 181)],
    ['NaN latitude', place(Number.NaN, 30)],
    ['infinite longitude', place(39, Number.POSITIVE_INFINITY)],
  ])('drops %s', (_label, candidate) => {
    expect(getMapMarkers([candidate], true)).toEqual([]);
  });

  it('drops a row whose coordinates are missing entirely', () => {
    const rows = [{ lat: undefined, lng: undefined, name: 'Eksik' }] as unknown as Parameters<
      typeof getMapMarkers
    >[0];

    expect(getMapMarkers(rows, true)).toEqual([]);
  });

  it('keeps the plottable places when only some rows are broken', () => {
    const markers = getMapMarkers(
      [place(39.78, 30.51, 'İyi'), place(0, 0, 'Bozuk'), place(41.01, 28.97, 'Diğer')],
      true,
    );

    expect(markers.map((marker) => marker.name)).toEqual(['İyi', 'Diğer']);
  });

  it('resolves a per-place colour against the original index', () => {
    const markers = getMapMarkers(
      [place(39.78, 30.51, 'ilk'), place(41.01, 28.97, 'ikinci')],
      true,
      (_candidate, index) => (index === 0 ? '#111111' : '#222222'),
    );

    expect(markers.map((marker) => marker.markerColor)).toEqual(['#111111', '#222222']);
  });

  it('returns nothing for an empty list rather than a placeholder marker', () => {
    expect(getMapMarkers([], true)).toEqual([]);
  });
});
