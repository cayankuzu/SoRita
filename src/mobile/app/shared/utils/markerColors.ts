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

export function getMapMarkers<TPlace extends MarkerPlaceLike>(
  places: TPlace[],
  isPublic?: boolean,
  resolveMarkerColor?: (place: TPlace, index: number) => string | undefined,
) {
  const markerColor = getListMarkerColor(isPublic);

  return places.map((place, index) => ({
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    markerColor: resolveMarkerColor?.(place, index) ?? markerColor,
  }));
}
