import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';
import { normalizeOptionalMultilineText } from '@/mobile/app/shared/validation/contentLimits';
import { createUuid } from '@/shared/utils/id';

type BuildOwnedPlaceListUpdatesParams = {
  createId?: () => string;
  editableLists: PlaceList[];
  place: Place;
  placeData: Omit<Place, 'id' | 'addedAt'>;
  targetListIds: string[];
  updatedAt: string;
};

function isMatchingPlace(
  left: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
  right: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
) {
  if (left.id && right.id) {
    return left.id === right.id;
  }

  return (
    Math.abs(left.lat - right.lat) < 0.00001 &&
    Math.abs(left.lng - right.lng) < 0.00001 &&
    normalizeSearchText(left.name) === normalizeSearchText(right.name)
  );
}

/** Builds the minimal list patch set for editing or moving an owned place. */
export function buildOwnedPlaceListUpdates({
  createId = createUuid,
  editableLists,
  place,
  placeData,
  targetListIds,
  updatedAt,
}: BuildOwnedPlaceListUpdatesParams) {
  const selectedListIds = new Set(targetListIds);
  const normalizedPlaceData: Omit<Place, 'id' | 'addedAt'> = {
    ...placeData,
    address: placeData.address?.trim() || undefined,
    notes: normalizeOptionalMultilineText(placeData.notes),
    title: normalizeOptionalMultilineText(placeData.title),
  };

  return editableLists
    .map((list) => {
      const matchedPlaceIndex = list.places.findIndex((item) => isMatchingPlace(item, place));
      const hasPlace = matchedPlaceIndex >= 0;
      const shouldContainPlace = selectedListIds.has(list.id);

      if (!hasPlace && !shouldContainPlace) {
        return null;
      }

      const membershipChanged = hasPlace !== shouldContainPlace;
      const matchedPlace = hasPlace ? list.places[matchedPlaceIndex] : null;
      const nextPlace: Place = {
        ...normalizedPlaceData,
        id: matchedPlace?.id || createId(),
        addedAt: matchedPlace?.addedAt || place.addedAt,
        updatedAt,
        addedBy: matchedPlace?.addedBy || placeData.addedBy || place.addedBy,
      };
      const nextPlaces = shouldContainPlace
        ? hasPlace
          ? list.places.map((item, index) => (index === matchedPlaceIndex ? nextPlace : item))
          : [...list.places, nextPlace]
        : list.places.filter((_, index) => index !== matchedPlaceIndex);

      return {
        ...list,
        places: nextPlaces,
        updatedAt: membershipChanged ? updatedAt : list.updatedAt,
      };
    })
    .filter((item): item is PlaceList => Boolean(item));
}
