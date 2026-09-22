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

  it('merges pins a few streets apart when zoomed out to a country', () => {
    const country = { latitude: 39, longitude: 32, latitudeDelta: 8, longitudeDelta: 8 };
    const clusters = clusterMapMarkers([
      { lat: 41.03, lng: 28.98, name: 'Karaköy' },
      { lat: 41.04, lng: 29.0, name: 'Beşiktaş' },
      { lat: 41.02, lng: 28.97, name: 'Galata' },
      { lat: 39.77, lng: 30.52, name: 'Eskişehir' },
    ], country);

    expect(clusters.map((cluster) => cluster.memberIndices.length).sort()).toEqual([1, 3]);
  });

  it('keeps one pin per place once zoomed in to a street', () => {
    const street = { latitude: 41.03, longitude: 28.98, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    const clusters = clusterMapMarkers([
      { lat: 41.0301, lng: 28.9801, name: 'A' },
      { lat: 41.0302, lng: 28.9802, name: 'B' },
    ], street);

    expect(clusters.map((cluster) => cluster.memberIndices)).toEqual([[0], [1]]);
  });
});
