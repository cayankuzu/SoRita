import { describe, expect, it } from 'vitest';

import {
  clusterMapMarkers,
  MAX_RENDERED_MAP_MARKERS,
} from '@/mobile/app/shared/components/maps/mapMarkerClustering';

const region = {
  latitude: 40,
  longitude: 29,
  latitudeDelta: 2,
  longitudeDelta: 2,
};

describe('clusterMapMarkers', () => {
  it('does not render places outside the current viewport', () => {
    const clusters = clusterMapMarkers([
      { lat: 40, lng: 29, name: 'Visible' },
      { lat: 10, lng: 10, name: 'Outside' },
    ], region);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].memberIndices).toEqual([0]);
  });

  it('keeps dense viewports within the native marker budget without losing members', () => {
    const places = Array.from({ length: 10_000 }, (_, index) => ({
      lat: 39.01 + (index % 100) * 0.0198,
      lng: 28.01 + Math.floor(index / 100) * 0.0198,
      name: `Place ${index}`,
    }));
    const startedAt = performance.now();
    const clusters = clusterMapMarkers(places, region);
    const durationMs = performance.now() - startedAt;

    expect(clusters.length).toBeLessThanOrEqual(MAX_RENDERED_MAP_MARKERS);
    expect(clusters.flatMap((cluster) => cluster.memberIndices)).toHaveLength(10_000);
    expect(clusters.some((cluster) => cluster.name.includes('mekânlık küme'))).toBe(true);
    expect(durationMs).toBeLessThan(250);
  });

  it('returns no marker when the configured budget is zero', () => {
    expect(clusterMapMarkers([{ lat: 40, lng: 29, name: 'Place' }], region, 0)).toEqual([]);
  });
});
