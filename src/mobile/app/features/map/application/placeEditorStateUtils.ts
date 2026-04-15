import type { Dispatch, SetStateAction } from 'react';

import { PLACE_CATEGORY_META } from '@/mobile/app/catalog/placeOptions';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';

const PHOTO_TILE_SIZE = 82;
const PHOTO_TILE_GAP = 10;

export const PHOTO_TILE_STRIDE = PHOTO_TILE_SIZE + PHOTO_TILE_GAP;

export function normalizePlaceIdentity(value?: string) {
  return value?.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ') || '';
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

export function reorderPhotos(items: string[], fromIndex: number, toIndex: number) {
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

  return ['other'];
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

  return lists.slice(0, 1).map((list) => list.id);
}

export function sortSelectedCategories(categories: string[]) {
  return [...categories].sort((left, right) =>
    (PLACE_CATEGORY_META[left]?.label || '').localeCompare(
      PLACE_CATEGORY_META[right]?.label || '',
      'tr',
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
  const { existingPlace, lat, lng, placeName, placeAddress } = params;

  return [existingPlace?.id || 'new', String(lat), String(lng), placeName || '', placeAddress || ''].join('|');
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
