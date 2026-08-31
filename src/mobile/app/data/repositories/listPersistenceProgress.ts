import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  arePlaceMediaArraysEqual,
  getPlaceMedia,
} from '@/mobile/app/shared/utils/placeMedia';

export type ProgressTracker = {
  advance: (units?: number) => void;
  completeUnit: (key: string) => void;
  setUnitProgress: (key: string, fraction: number) => void;
};

export type ListPlaceChanges = {
  previousPlacesById: Map<string, Place>;
  removedPlaces: Place[];
  placesToUpsert: Place[];
};

type ArePlacesEquivalent = (left: Place, right: Place) => boolean;
type GetListPlaceChanges = (list: PlaceList, previousList?: PlaceList | null) => ListPlaceChanges;

export function isPendingUploadUri(value?: string | null) {
  return Boolean(value && (value.startsWith('file://') || value.startsWith('content://')));
}

export function createProgressTracker(
  totalUnits: number,
  onProgress?: (progress: number) => void,
): ProgressTracker {
  if (!onProgress) {
    return {
      advance: () => undefined,
      completeUnit: () => undefined,
      setUnitProgress: () => undefined,
    };
  }

  const total = Math.max(1, totalUnits);
  let completed = 0;
  let lastEmittedProgress = 0;
  const completedUnitKeys = new Set<string>();
  const inFlightUnitProgress = new Map<string, number>();

  const emit = () => {
    const inFlightProgress = Array.from(inFlightUnitProgress.values()).reduce(
      (sum, value) => sum + value,
      0,
    );
    const progress = Math.round(((completed + inFlightProgress) / total) * 100);
    const boundedProgress = Math.max(0, Math.min(99, progress));

    if (boundedProgress === lastEmittedProgress) {
      return;
    }

    lastEmittedProgress = boundedProgress;
    onProgress(boundedProgress);
  };

  onProgress(0);

  return {
    advance(units = 1) {
      completed += units;
      emit();
    },
    completeUnit(key) {
      if (completedUnitKeys.has(key)) {
        return;
      }

      completedUnitKeys.add(key);
      inFlightUnitProgress.delete(key);
      completed += 1;
      emit();
    },
    setUnitProgress(key, fraction) {
      if (completedUnitKeys.has(key)) {
        return;
      }

      inFlightUnitProgress.set(key, Math.max(0, Math.min(0.99, fraction)));
      emit();
    },
  };
}

export function getListPlaceChanges(
  list: PlaceList,
  previousList: PlaceList | null | undefined,
  arePlacesEquivalent: ArePlacesEquivalent,
): ListPlaceChanges {
  const previousPlaces = previousList?.places || [];
  const nextPlaceIds = new Set(list.places.map((place) => place.id));
  const previousPlacesById = new Map(previousPlaces.map((place) => [place.id, place]));

  return {
    previousPlacesById,
    removedPlaces: previousPlaces.filter((place) => !nextPlaceIds.has(place.id)),
    placesToUpsert: list.places.filter((place) => {
      const previousPlace = previousPlacesById.get(place.id);
      return !previousPlace || !arePlacesEquivalent(place, previousPlace);
    }),
  };
}

function estimatePlaceMediaUnits(place: Place, previousPlace?: Place | null) {
  const media = getPlaceMedia(place);
  const previousMedia = getPlaceMedia(previousPlace);

  if (previousPlace && arePlaceMediaArraysEqual(media, previousMedia)) {
    return 0;
  }

  return media.reduce(
    (total, item) =>
      total +
      (item.url ? 1 : 0) +
      (isPendingUploadUri(item.thumbnailUrl) ? 1 : 0),
    0,
  );
}

export function estimateListUpdateUnits(
  list: PlaceList,
  previousList: PlaceList | null | undefined,
  getChanges: GetListPlaceChanges,
) {
  const { placesToUpsert, previousPlacesById, removedPlaces } = getChanges(list, previousList);
  const replacedCoverUnits = previousList?.coverImage && previousList.coverImage !== list.coverImage ? 1 : 0;
  const placeUnits = placesToUpsert.reduce(
    (total, place) =>
      total + 1 + estimatePlaceMediaUnits(place, previousPlacesById.get(place.id)),
    0,
  );

  return Math.max(
    1,
    1 +
      (list.coverImage ? 1 : 0) +
      (removedPlaces.length > 0 ? 1 : 0) +
      replacedCoverUnits +
      placeUnits,
  );
}

export function estimateUpdateListsUnits(
  lists: PlaceList[],
  previousLists: PlaceList[] | undefined,
  getChanges: GetListPlaceChanges,
) {
  const previousListsById = new Map(previousLists?.map((list) => [list.id, list]) ?? []);
  return Math.max(
    1,
    lists.reduce(
      (total, list) =>
        total + estimateListUpdateUnits(list, previousListsById.get(list.id), getChanges),
      0,
    ),
  );
}
