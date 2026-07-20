import { supabase } from '@/mobile/app/platform/supabase/client';
import {
  getMarkerAggregationKey,
  getMarkerColorByVisibility,
  getMarkerVisibilityForPublicFlags,
  type MarkerVisibilityState,
} from '@/mobile/app/shared/utils/markerColors';

type MapListRow = {
  is_public: boolean;
  list_places?: Array<{
    lat: number;
    lng: number;
    name: string;
    updated_at: string;
  }> | null;
};

export type MapMarkerSnapshot = {
  lat: number;
  lng: number;
  markerColor: string;
  markerKind: 'saved';
  markerVisibility: MarkerVisibilityState;
  name: string;
  targetLocationKey: string;
};

const MAP_LIST_LIMIT = 100;
const MAP_PLACES_PER_LIST_LIMIT = 250;

export async function fetchOwnedMapMarkers(viewerId: string) {
  const { data, error } = await supabase
    .from('lists')
    .select(`
      is_public,
      list_places:list_places!list_places_list_id_fkey (
        lat,
        lng,
        name,
        updated_at
      )
    `)
    .eq('owner_id', viewerId)
    .order('updated_at', { ascending: false })
    .limit(MAP_LIST_LIMIT)
    .limit(MAP_PLACES_PER_LIST_LIMIT, {
      foreignTable: 'list_places!list_places_list_id_fkey',
    });

  if (error) {
    throw error;
  }

  const groups = new Map<
    string,
    {
      flags: boolean[];
      lat: number;
      lng: number;
      name: string;
      updatedAt: string;
    }
  >();

  for (const list of (data || []) as unknown as MapListRow[]) {
    for (const place of list.list_places || []) {
      const key = getMarkerAggregationKey(place);
      const current = groups.get(key);

      if (!current) {
        groups.set(key, {
          flags: [list.is_public],
          lat: place.lat,
          lng: place.lng,
          name: place.name,
          updatedAt: place.updated_at,
        });
        continue;
      }

      current.flags.push(list.is_public);
      if (place.updated_at > current.updatedAt) {
        current.name = place.name;
        current.updatedAt = place.updated_at;
      }
    }
  }

  return [...groups.entries()].map<MapMarkerSnapshot>(([targetLocationKey, group]) => {
    const markerVisibility = getMarkerVisibilityForPublicFlags(group.flags);

    return {
      lat: group.lat,
      lng: group.lng,
      markerColor: getMarkerColorByVisibility(markerVisibility),
      markerKind: 'saved',
      markerVisibility,
      name: group.name,
      targetLocationKey,
    };
  });
}

export const mapMarkersRepositoryInternals = {
  MAP_LIST_LIMIT,
  MAP_PLACES_PER_LIST_LIMIT,
};
