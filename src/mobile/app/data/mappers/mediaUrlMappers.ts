import type { Place } from '@/mobile/app/data/contracts/entities';
import {
  arePlaceMediaArraysEqual,
  getPlaceMedia,
  getPlacePhotoUrls,
} from '@/mobile/app/shared/utils/placeMedia';
export { uniqueStrings } from '@/mobile/app/shared/utils/format';

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeStoredMediaUrl(uri?: string | null) {
  if (!uri) {
    return undefined;
  }

  const normalized = uri.trim();

  if (!normalized || normalized.startsWith('file://') || normalized.startsWith('content://')) {
    return undefined;
  }

  return normalized;
}

export function normalizeListCoverUrl(uri?: string | null) {
  if (!uri) {
    return undefined;
  }

  const normalized = uri.trim();
  return normalized || undefined;
}

export function isLocalMediaUri(uri?: string | null) {
  if (!uri) {
    return false;
  }

  return uri.startsWith('file://') || uri.startsWith('content://');
}

export function areStringArraysEqual(left?: string[] | null, right?: string[] | null) {
  const normalizedLeft = left || [];
  const normalizedRight = right || [];

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((item, index) => item === normalizedRight[index]);
}

export function arePlacePhotosEqual(left?: string[] | null, right?: string[] | null) {
  const normalizedLeft = left || [];
  const normalizedRight = right || [];

  if (
    normalizedLeft.some((photo) => isLocalMediaUri(photo)) ||
    normalizedRight.some((photo) => isLocalMediaUri(photo))
  ) {
    return false;
  }

  return areStringArraysEqual(normalizedLeft, normalizedRight);
}

export function isSamePlaceContent(previousPlace: Place, nextPlace: Place) {
  return (
    previousPlace.id === nextPlace.id &&
    previousPlace.name === nextPlace.name &&
    previousPlace.title === nextPlace.title &&
    previousPlace.lat === nextPlace.lat &&
    previousPlace.lng === nextPlace.lng &&
    previousPlace.address === nextPlace.address &&
    previousPlace.notes === nextPlace.notes &&
    previousPlace.rating === nextPlace.rating &&
    previousPlace.category === nextPlace.category &&
    previousPlace.studentDiscount === nextPlace.studentDiscount &&
    previousPlace.priceRange === nextPlace.priceRange &&
    previousPlace.priceMin === nextPlace.priceMin &&
    previousPlace.priceMax === nextPlace.priceMax &&
    previousPlace.bestTime === nextPlace.bestTime &&
    previousPlace.addedAt === nextPlace.addedAt &&
    previousPlace.updatedAt === nextPlace.updatedAt &&
    previousPlace.addedBy?.userId === nextPlace.addedBy?.userId &&
    areStringArraysEqual(previousPlace.categories, nextPlace.categories) &&
    areStringArraysEqual(previousPlace.bestTimes, nextPlace.bestTimes) &&
    areStringArraysEqual(previousPlace.atmosphere, nextPlace.atmosphere) &&
    areStringArraysEqual(previousPlace.specialFeatures, nextPlace.specialFeatures) &&
    arePlacePhotosEqual(getPlacePhotoUrls(previousPlace), getPlacePhotoUrls(nextPlace)) &&
    arePlaceMediaArraysEqual(getPlaceMedia(previousPlace), getPlaceMedia(nextPlace))
  );
}
