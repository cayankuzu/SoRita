import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { fetchOwnedMapMarkers } from '@/mobile/app/data/repositories/mapMarkersRepository';

export const MAP_MARKERS_STALE_TIME_MS = 1000 * 60 * 10;

export function useMapMarkersQuery(userId?: string | null) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: userId ? queryKeys.map.markers(userId) : queryKeys.map.all,
    queryFn: () => (userId ? fetchOwnedMapMarkers(userId) : Promise.resolve([])),
    staleTime: MAP_MARKERS_STALE_TIME_MS,
  });
}
