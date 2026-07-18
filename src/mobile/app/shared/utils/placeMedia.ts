import {
  inferPlaceMediaType,
  type PlaceMedia,
  type PlaceMediaContainer,
} from '@/mobile/app/contracts/placeMedia';

function isLocalUri(value?: string | null) {
  if (!value) {
    return false;
  }

  return value.startsWith('file://') || value.startsWith('content://');
}

export { inferPlaceMediaType };

export function normalizePlaceMedia(
  media?: PlaceMedia[] | null,
  fallbackPhotos?: string[] | null,
): PlaceMedia[] {
  if (media?.length) {
    return media
      .filter((item): item is PlaceMedia => Boolean(item?.url))
      .map((item) => ({
        ...item,
        type: item.type || inferPlaceMediaType({ mimeType: item.mimeType, url: item.url }),
      }));
  }

  return (fallbackPhotos || [])
    .filter(Boolean)
    .map((url) => ({
      type: 'photo' as const,
      url,
    }));
}

export function getPlaceMedia(place?: PlaceMediaContainer | null) {
  return normalizePlaceMedia(place?.media, place?.photos);
}

export function getPlacePhotoUrls(place?: PlaceMediaContainer | null) {
  return getPlaceMedia(place)
    .filter((item) => item.type === 'photo')
    .map((item) => item.url);
}

export function getPlaceMediaCounts(media?: PlaceMedia[] | null) {
  return (media || []).reduce(
    (totals, item) => {
      if (item.type === 'video') {
        totals.videos += 1;
      } else {
        totals.photos += 1;
      }

      totals.total += 1;
      return totals;
    },
    { photos: 0, total: 0, videos: 0 },
  );
}

export function formatPlaceMediaDuration(durationMs?: number | null) {
  if (!durationMs || durationMs < 1000) {
    return '0:00';
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function arePlaceMediaArraysEqual(
  left?: PlaceMedia[] | null,
  right?: PlaceMedia[] | null,
) {
  const normalizedLeft = left || [];
  const normalizedRight = right || [];

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  if (
    normalizedLeft.some((item) => isLocalUri(item.url) || isLocalUri(item.thumbnailUrl)) ||
    normalizedRight.some((item) => isLocalUri(item.url) || isLocalUri(item.thumbnailUrl))
  ) {
    return false;
  }

  return normalizedLeft.every((leftItem, index) => {
    const rightItem = normalizedRight[index];

    if (!rightItem) {
      return false;
    }

      return (
        leftItem.url === rightItem.url &&
        leftItem.type === rightItem.type &&
        leftItem.mimeType === rightItem.mimeType &&
        leftItem.durationMs === rightItem.durationMs &&
        leftItem.thumbnailTimeMs === rightItem.thumbnailTimeMs &&
        leftItem.thumbnailUrl === rightItem.thumbnailUrl &&
        leftItem.width === rightItem.width &&
        leftItem.height === rightItem.height
      );
  });
}
