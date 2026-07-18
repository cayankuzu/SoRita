import type { Dispatch, SetStateAction } from 'react';

import { PLACE_CATEGORY_META } from '@/mobile/app/catalog/placeOptions';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { compareLocalizedText, normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

export function normalizePlaceIdentity(value?: string) {
  return normalizeSearchText(value);
}

export function isEquivalentTargetPlace(
  candidate: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
  reference: { id?: string | null; name?: string; lat: number; lng: number },
) {
  if (reference.id && candidate.id === reference.id) {
    return true;
  }

  const sameCoordinates =
    Math.abs(candidate.lat - reference.lat) < 0.00001 &&
    Math.abs(candidate.lng - reference.lng) < 0.00001;

  if (!sameCoordinates) {
    return false;
  }

  const referenceName = normalizePlaceIdentity(reference.name);
  const candidateName = normalizePlaceIdentity(candidate.name);

  if (!referenceName || !candidateName) {
    return true;
  }

  return referenceName === candidateName;
}

export function reorderPhotos<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function swapPhotos<T>(items: T[], leftIndex: number, rightIndex: number) {
  if (
    leftIndex === rightIndex ||
    leftIndex < 0 ||
    rightIndex < 0 ||
    leftIndex >= items.length ||
    rightIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const leftItem = nextItems[leftIndex];
  const rightItem = nextItems[rightIndex];

  if (!leftItem || !rightItem) {
    return items;
  }

  nextItems[leftIndex] = rightItem;
  nextItems[rightIndex] = leftItem;
  return nextItems;
}

export function toggleArrayValue(value: string, setter: Dispatch<SetStateAction<string[]>>) {
  setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
}

export function getInitialSelectedCategories(existingPlace?: Place | null) {
  if (existingPlace?.categories?.length) {
    return existingPlace.categories;
  }

  if (existingPlace?.category) {
    return [existingPlace.category];
  }

  return [];
}

export function getInitialBestTimes(existingPlace?: Place | null) {
  if (existingPlace?.bestTimes?.length) {
    return existingPlace.bestTimes;
  }

  return existingPlace?.bestTime ? [existingPlace.bestTime] : [];
}

export function getInitialSelectedLists(existingPlace: Place | null | undefined, lists: PlaceList[]) {
  if (existingPlace) {
    return lists
      .filter((list) => list.places.some((place) => place.id === existingPlace.id))
      .map((list) => list.id);
  }

  return [];
}

export function sortSelectedCategories(categories: string[]) {
  return [...categories].sort((left, right) =>
    compareLocalizedText(
      PLACE_CATEGORY_META[left]?.label || '',
      PLACE_CATEGORY_META[right]?.label || '',
    ),
  );
}

export function buildEditorSourceKey(params: {
  existingPlace?: Place | null;
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
}) {
  const { existingPlace, lat, lng } = params;

  return [existingPlace?.id || 'new', String(lat), String(lng)].join('|');
}

export function filterSafeSelectedLists(
  selectedLists: string[],
  duplicateListIds: Set<string>,
  currentMembershipListIds: Set<string>,
  availableListIds?: Set<string>,
) {
  return selectedLists.filter(
    (listId) =>
      (!availableListIds || availableListIds.has(listId)) &&
      (!duplicateListIds.has(listId) || currentMembershipListIds.has(listId)),
  );
}
