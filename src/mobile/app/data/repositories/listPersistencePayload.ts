// How a list and its places are compared and shaped for the database: pure functions, no I/O.

import type { Place, PlaceList, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { arePlaceMediaArraysEqual, getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';
import { normalizeSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';
import { assertNoObjectionableContent } from '@/mobile/app/shared/utils/contentModeration';
import {
  clampMultilineTextLength,
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_MENU_URL_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  clampTextLength,
  encodePersistedLineBreaks,
  trimPreservingLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';
import { uniqueStrings } from '@/mobile/app/shared/utils/format';
import {
  estimateListUpdateUnits as calculateListUpdateUnits,
  estimateUpdateListsUnits as calculateUpdateListsUnits,
  getListPlaceChanges as calculateListPlaceChanges,
} from './listPersistenceProgress';

export function resolvePlaceName(place: Place) {
  return (
    place.name?.trim() ||
    place.title?.trim() ||
    place.address?.trim() ||
    tr.cards.savedPlaceFallback
  );
}

export function uniqueOrderedStrings(values?: string[]) {
  return uniqueStrings(values);
}

export function areStringArraysEqual(left?: string[], right?: string[]) {
  const normalizedLeft = uniqueOrderedStrings(left);
  const normalizedRight = uniqueOrderedStrings(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export const persistedPlaceFields = [
  'id',
  'name',
  'title',
  'menuUrl',
  'lat',
  'lng',
  'address',
  'notes',
  'rating',
  'category',
  'studentDiscount',
  'priceRange',
  'priceMin',
  'priceMax',
  'bestTime',
] as const satisfies ReadonlyArray<keyof Place>;

export const persistedSourceFields = [
  'listId',
  'placeId',
  'placeName',
  'userAvatar',
  'userId',
  'userName',
] as const satisfies ReadonlyArray<keyof NonNullable<Place['sourceAttribution']>>;

export function arePlacesEquivalentForPersistence(left: Place, right: Place) {
  return (
    persistedPlaceFields.every((field) => left[field] === right[field]) &&
    persistedSourceFields.every(
      (field) => left.sourceAttribution?.[field] === right.sourceAttribution?.[field],
    ) &&
    areStringArraysEqual(left.categories, right.categories) &&
    areStringArraysEqual(left.bestTimes, right.bestTimes) &&
    areStringArraysEqual(left.atmosphere, right.atmosphere) &&
    areStringArraysEqual(left.specialFeatures, right.specialFeatures) &&
    arePlaceMediaArraysEqual(getPlaceMedia(left), getPlaceMedia(right))
  );
}

export function normalizeListNameForPersistence(value: string) {
  return clampTextLength(value, LIST_NAME_MAX_LENGTH).trim();
}

export function normalizeListDescriptionForPersistence(value?: string) {
  return (
    trimPreservingLineBreaks(
      clampMultilineTextLength(value, LIST_DESCRIPTION_MAX_LENGTH),
    ) || null
  );
}

export function normalizePlaceMenuUrlForPersistence(value?: string) {
  const trimmedValue = clampTextLength(value, PLACE_MENU_URL_MAX_LENGTH).trim();

  if (!trimmedValue) {
    return null;
  }

  const safeUrl = normalizeSafeExternalUrl(trimmedValue);

  if (!safeUrl) {
    throw new Error(tr.placeEditor.menuUrlInvalid);
  }

  return safeUrl;
}

export function areListMetadataEquivalentForPersistence(
  currentList: PlaceList,
  previousList: PlaceList,
  nextCoverImage?: string | null,
) {
  return (
    currentList.userId === previousList.userId &&
    normalizeListNameForPersistence(currentList.name) ===
      normalizeListNameForPersistence(previousList.name) &&
    normalizeListDescriptionForPersistence(currentList.description) ===
      normalizeListDescriptionForPersistence(previousList.description) &&
    (currentList.emoji || null) === (previousList.emoji || null) &&
    Boolean(currentList.isPublic) === Boolean(previousList.isPublic) &&
    (nextCoverImage || null) === (previousList.coverImage || null)
  );
}

export function getListPlaceChanges(list: PlaceList, previousList?: PlaceList | null) {
  return calculateListPlaceChanges(list, previousList, arePlacesEquivalentForPersistence);
}

export function estimateListUpdateUnits(list: PlaceList, previousList?: PlaceList | null) {
  return calculateListUpdateUnits(list, previousList, getListPlaceChanges);
}

export function estimateUpdateListsUnits(lists: PlaceList[], previousLists?: PlaceList[]) {
  return calculateUpdateListsUnits(lists, previousLists, getListPlaceChanges);
}

export function getPlaceStorageUrls(place?: Place | null) {
  return getPlaceMedia(place).flatMap((item) =>
    [item.url, item.thumbnailUrl].filter((value): value is string => Boolean(value)),
  );
}

export function normalizePlaceFields(place: Place) {
  const fields = {
    address: clampTextLength(place.address, PLACE_ADDRESS_MAX_LENGTH),
    menuUrl: normalizePlaceMenuUrlForPersistence(place.menuUrl),
    name: clampTextLength(resolvePlaceName(place), PLACE_NAME_MAX_LENGTH),
    notes: clampMultilineTextLength(place.notes, PLACE_NOTES_MAX_LENGTH),
    title: clampMultilineTextLength(place.title, PLACE_TITLE_MAX_LENGTH),
  };

  assertNoObjectionableContent([
    { label: tr.moderation.placeNameField, value: fields.name },
    { label: tr.moderation.placeTitleField, value: fields.title },
    { label: tr.moderation.placeNoteField, value: fields.notes },
  ]);

  return fields;
}

export function nullable<T>(value: T | null | undefined) {
  return value ?? null;
}

export function firstText(...values: Array<string | null | undefined>) {
  return values.find(Boolean) || null;
}

export function persistedText(value?: string | null) {
  return firstText(encodePersistedLineBreaks(trimPreservingLineBreaks(value)));
}

export function persistedStrings(values?: string[], fallback?: string) {
  return uniqueStrings(values?.length ? values : fallback ? [fallback] : []);
}

export function buildPlacePayload(
  list: PlaceList,
  place: Place,
  fields: ReturnType<typeof normalizePlaceFields>,
) {
  return {
    id: place.id,
    list_id: list.id,
    // The actor writing into this owned list is the creator. Any quoted
    // attribution is preserved separately in the source_* fields below.
    created_by: list.userId,
    source_list_id: nullable(place.sourceAttribution?.listId),
    source_place_id: nullable(place.sourceAttribution?.placeId),
    source_place_name: nullable(place.sourceAttribution?.placeName),
    source_user_avatar_url: nullable(place.sourceAttribution?.userAvatar),
    source_user_id: nullable(place.sourceAttribution?.userId),
    source_user_name: nullable(place.sourceAttribution?.userName),
    name: fields.name,
    title: persistedText(fields.title),
    menu_url: fields.menuUrl,
    lat: place.lat,
    lng: place.lng,
    address: firstText(fields.address),
    notes: persistedText(fields.notes),
    rating: nullable(place.rating),
    category: firstText(place.category),
    categories: persistedStrings(place.categories, place.category),
    student_discount: Boolean(place.studentDiscount),
    price_range: nullable(place.priceRange),
    price_min: nullable(place.priceMin),
    price_max: nullable(place.priceMax),
    best_time: firstText(place.bestTime),
    best_times: persistedStrings(place.bestTimes),
    atmosphere: persistedStrings(place.atmosphere),
    special_features: persistedStrings(place.specialFeatures),
    added_at: place.addedAt,
    updated_at: firstText(place.updatedAt, place.addedAt),
  };
}

export function buildPlaceMediaPayload(media: PlaceMedia[]) {
  return media.map((item) => ({
    durationMs: nullable(item.durationMs),
    height: nullable(item.height),
    id: nullable(item.id),
    mimeType: nullable(item.mimeType),
    thumbnailUrl: nullable(item.thumbnailUrl),
    type: item.type,
    url: item.url,
    width: nullable(item.width),
  }));
}
