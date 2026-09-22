import { colors } from '@/mobile/app/shared/theme/tokens';

type MarkerPlaceLike = {
  lat: number;
  lng: number;
  name: string;
};

type MarkerPlaceListLike = {
  places: MarkerPlaceLike[];
  isPublic: boolean;
};

type MarkerMembershipLike = {
  listIsPublic: boolean;
};

export type MarkerVisibilityState = 'public' | 'private' | 'mixed';

export type MapMarkerItem = {
  lat: number;
  lng: number;
  name: string;
  markerColor?: string;
  markerVisibility?: MarkerVisibilityState;
  markerKind?: 'saved' | 'search' | 'editor';
};

export function getMarkerAggregationKey(place: Pick<MarkerPlaceLike, 'lat' | 'lng'>) {
  return [place.lat.toFixed(5), place.lng.toFixed(5)].join(':');
}

export function getMarkerVisibilityForPublicFlags(
  publicFlags: Iterable<boolean>,
  fallbackIsPublic = true,
): MarkerVisibilityState {
  let hasPublic = false;
  let hasPrivate = false;

  for (const isPublic of publicFlags) {
    if (isPublic) {
      hasPublic = true;
    } else {
      hasPrivate = true;
    }

    if (hasPublic && hasPrivate) {
      return 'mixed';
    }
  }

  if (hasPublic) {
    return 'public';
  }

  if (hasPrivate) {
    return 'private';
  }

  return fallbackIsPublic ? 'public' : 'private';
}

export function getMarkerColorByVisibility(visibility: MarkerVisibilityState) {
  if (visibility === 'private') {
    return colors.visibilityPrivate;
  }

  if (visibility === 'mixed') {
    return colors.visibilityMixed;
  }

  return colors.visibilityPublic;
}

export function getListMarkerColor(isPublic?: boolean) {
  return getMarkerColorByVisibility(isPublic === false ? 'private' : 'public');
}

export function getMarkerColorForMemberships(
  memberships?: MarkerMembershipLike[],
  fallbackIsPublic = true,
) {
  if (!memberships?.length) {
    return getListMarkerColor(fallbackIsPublic);
  }

  return getMarkerColorByVisibility(
    getMarkerVisibilityForPublicFlags(
      memberships.map((membership) => membership.listIsPublic),
      fallbackIsPublic,
    ),
  );
}

export function getMarkerVisibilityForPlaceAcrossLists(
  place: Pick<MarkerPlaceLike, 'lat' | 'lng'>,
  lists: MarkerPlaceListLike[],
  fallbackIsPublic = true,
) {
  const targetKey = getMarkerAggregationKey(place);
  const matchingPublicFlags: boolean[] = [];

  for (const list of lists) {
    for (const candidatePlace of list.places) {
      if (getMarkerAggregationKey(candidatePlace) === targetKey) {
        matchingPublicFlags.push(list.isPublic);
      }
    }
  }

  return getMarkerVisibilityForPublicFlags(matchingPublicFlags, fallbackIsPublic);
}

export function getMarkerColorForPlaceAcrossLists(
  place: Pick<MarkerPlaceLike, 'lat' | 'lng'>,
  lists: MarkerPlaceListLike[],
  fallbackIsPublic = true,
) {
  return getMarkerColorByVisibility(
    getMarkerVisibilityForPlaceAcrossLists(place, lists, fallbackIsPublic),
  );
}

/**
 * A pair that cannot be a real pin on this map.
 *
 * Nothing validated coordinates before they reached the Static Maps URL, so a
 * row with a missing or zeroed position asked Google for 0,0 - open water in
 * the Gulf of Guinea - and the card rendered a featureless blue rectangle with
 * a marker in it. Rejecting the pair here lets the caller fall back to the
 * "preview unavailable" state, which is at least honest about having nothing
 * to show.
 */
function isPlottableCoordinate(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;

  // Exactly 0,0 is the default an unset column leaves behind far more often
  // than it is a place someone saved in the Atlantic.
  return lat !== 0 || lng !== 0;
}

export function getMapMarkers<TPlace extends MarkerPlaceLike>(
  places: TPlace[],
  isPublic?: boolean,
  resolveMarkerColor?: (place: TPlace, index: number) => string | undefined,
) {
  const markerColor = getListMarkerColor(isPublic);

  return places
    .map((place, index) => ({
      lat: place.lat,
      lng: place.lng,
      name: place.name,
      markerColor: resolveMarkerColor?.(place, index) ?? markerColor,
    }))
    .filter((marker) => isPlottableCoordinate(marker.lat, marker.lng));
}
