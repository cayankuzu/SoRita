import { useMemo } from 'react';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  filterSafeSelectedLists,
  getDuplicateListIds,
  normalizePersistablePlaceIdentity,
} from '@/mobile/app/features/map/application/placeEditorStateUtils';

type UsePlaceEditorListIdentityParams = {
  currentName: string;
  draftName?: string;
  existingPlace?: Place | null;
  lat: number;
  lists: PlaceList[];
  lng: number;
  placeName?: string;
  selectedLists: string[];
};

export function usePlaceEditorListIdentity({
  currentName,
  draftName,
  existingPlace,
  lat,
  lists,
  lng,
  placeName,
  selectedLists,
}: UsePlaceEditorListIdentityParams) {
  const currentMembershipListIds = useMemo(
    () =>
      new Set(
        existingPlace
          ? lists
              .filter((list) => list.places.some((place) => place.id === existingPlace.id))
              .map((list) => list.id)
          : [],
      ),
    [existingPlace, lists],
  );
  const duplicateListIds = useMemo(
    () =>
      getDuplicateListIds(lists, {
        id: existingPlace?.id,
        name:
          normalizePersistablePlaceIdentity(existingPlace?.name) ||
          normalizePersistablePlaceIdentity(placeName) ||
          normalizePersistablePlaceIdentity(draftName) ||
          normalizePersistablePlaceIdentity(currentName) ||
          undefined,
        lat,
        lng,
      }),
    [currentName, draftName, existingPlace?.id, existingPlace?.name, lat, lists, lng, placeName],
  );
  const availableListIds = useMemo(() => new Set(lists.map((list) => list.id)), [lists]);
  const safeSelectedLists = useMemo(
    () =>
      filterSafeSelectedLists(
        selectedLists,
        duplicateListIds,
        currentMembershipListIds,
        availableListIds,
      ),
    [availableListIds, currentMembershipListIds, duplicateListIds, selectedLists],
  );
  const pendingAddedListCount = useMemo(
    () => safeSelectedLists.filter((listId) => !currentMembershipListIds.has(listId)).length,
    [currentMembershipListIds, safeSelectedLists],
  );

  return {
    currentMembershipListIds,
    duplicateListIds,
    hasTargetListSelection: safeSelectedLists.length > 0,
    pendingAddedListCount,
    safeSelectedLists,
  };
}
