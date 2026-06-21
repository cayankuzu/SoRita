import type { Place, PlaceList, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import {
  fetchVisibleDataContext,
  fetchVisibleListsPage,
} from '@/mobile/app/data/repositories/visibleDataRepository';
import {
  deleteStorageAssetsByUrls,
  uploadImageAsset,
  uploadPlaceMediaAsset,
} from '@/mobile/app/platform/supabase/media';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  arePlaceMediaArraysEqual,
  getPlaceMedia,
  getPlacePhotoUrls,
  normalizePlaceMedia,
} from '@/mobile/app/shared/utils/placeMedia';
import { assertNoObjectionableContent } from '@/mobile/app/shared/utils/contentModeration';
import {
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  clampTextLength,
} from '@/mobile/app/shared/validation/contentLimits';

function uniqueStrings(values?: string[]) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function resolvePlaceName(place: Place) {
  return (
    place.name?.trim() ||
    place.title?.trim() ||
    place.address?.trim() ||
    tr.cards.savedPlaceFallback
  );
}

function uniqueOrderedStrings(values?: string[]) {
  return uniqueStrings(values);
}

function areStringArraysEqual(left?: string[], right?: string[]) {
  const normalizedLeft = uniqueOrderedStrings(left);
  const normalizedRight = uniqueOrderedStrings(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function arePlacesEquivalentForPersistence(left: Place, right: Place) {
  return (
    left.id === right.id &&
    left.sourceAttribution?.listId === right.sourceAttribution?.listId &&
    left.sourceAttribution?.placeId === right.sourceAttribution?.placeId &&
    left.sourceAttribution?.placeName === right.sourceAttribution?.placeName &&
    left.sourceAttribution?.userAvatar === right.sourceAttribution?.userAvatar &&
    left.sourceAttribution?.userId === right.sourceAttribution?.userId &&
    left.sourceAttribution?.userName === right.sourceAttribution?.userName &&
    left.name === right.name &&
    left.title === right.title &&
    left.lat === right.lat &&
    left.lng === right.lng &&
    left.address === right.address &&
    left.notes === right.notes &&
    left.rating === right.rating &&
    left.category === right.category &&
    left.studentDiscount === right.studentDiscount &&
    left.priceRange === right.priceRange &&
    left.priceMin === right.priceMin &&
    left.priceMax === right.priceMax &&
    left.bestTime === right.bestTime &&
    areStringArraysEqual(left.categories, right.categories) &&
    areStringArraysEqual(left.bestTimes, right.bestTimes) &&
    areStringArraysEqual(left.atmosphere, right.atmosphere) &&
    areStringArraysEqual(left.specialFeatures, right.specialFeatures) &&
    arePlaceMediaArraysEqual(getPlaceMedia(left), getPlaceMedia(right))
  );
}

type ProgressTracker = {
  advance: (units?: number) => void;
};

function createProgressTracker(totalUnits: number, onProgress?: (progress: number) => void): ProgressTracker {
  if (!onProgress) {
    return {
      advance: () => undefined,
    };
  }

  const total = Math.max(1, totalUnits);
  let completed = 0;

  const emit = () => {
    const progress = Math.round((completed / total) * 100);
    onProgress(Math.max(0, Math.min(99, progress)));
  };

  onProgress(0);

  return {
    advance(units = 1) {
      completed += units;
      emit();
    },
  };
}

function estimateListUpdateUnits(list: PlaceList) {
  return Math.max(
    1,
    1 + (list.coverImage ? 1 : 0) + list.places.length + list.places.reduce(
      (total, place) => total + getPlaceMedia(place).filter((item) => Boolean(item.url)).length,
      0,
    ),
  );
}

function estimateUpdateListsUnits(lists: PlaceList[]) {
  return Math.max(1, lists.reduce((total, list) => total + estimateListUpdateUnits(list), 0));
}

function getPlaceStorageUrls(place?: Place | null) {
  return getPlaceMedia(place).flatMap((item) =>
    [item.url, item.thumbnailUrl].filter((value): value is string => Boolean(value)),
  );
}

async function uploadPlaceMedia(
  listId: string,
  place: Place,
  userId: string,
  progressTracker?: ProgressTracker,
) {
  const uploadedMedia: PlaceMedia[] = [];
  const nextMedia = normalizePlaceMedia(place.media, place.photos);

  for (const [index, item] of nextMedia.entries()) {
    const uploadedUrl = await uploadPlaceMediaAsset({
      mimeType: item.mimeType,
      prefix: `${listId}/${place.id}/${index}`,
      uri: item.url,
      userId,
    }).finally(() => {
      progressTracker?.advance();
    });

    uploadedMedia.push({
      ...item,
      thumbnailUrl:
        item.thumbnailUrl && !item.thumbnailUrl.startsWith('file://') && !item.thumbnailUrl.startsWith('content://')
          ? item.thumbnailUrl
          : undefined,
      url: uploadedUrl || item.url,
    });
  }

  return uploadedMedia;
}

async function upsertPlace(
  list: PlaceList,
  place: Place,
  previousPlace?: Place | null,
  progressTracker?: ProgressTracker,
) {
  const normalizedPlaceName = clampTextLength(resolvePlaceName(place), PLACE_NAME_MAX_LENGTH);
  const normalizedPlaceTitle = clampTextLength(place.title, PLACE_TITLE_MAX_LENGTH);
  const normalizedPlaceAddress = clampTextLength(place.address, PLACE_ADDRESS_MAX_LENGTH);
  const normalizedPlaceNotes = clampTextLength(place.notes, PLACE_NOTES_MAX_LENGTH);

  assertNoObjectionableContent([
    { label: tr.moderation.placeNameField, value: normalizedPlaceName },
    { label: tr.moderation.placeTitleField, value: normalizedPlaceTitle },
    { label: tr.moderation.placeNoteField, value: normalizedPlaceNotes },
  ]);

  const nextPlaceMedia = normalizePlaceMedia(place.media, place.photos);
  const previousPlaceMedia = normalizePlaceMedia(previousPlace?.media, previousPlace?.photos);
  const shouldSyncMedia = !previousPlace || !arePlaceMediaArraysEqual(nextPlaceMedia, previousPlaceMedia);
  const uploadedMedia = shouldSyncMedia
    ? await uploadPlaceMedia(
        list.id,
        {
          ...place,
          media: nextPlaceMedia,
          photos: getPlacePhotoUrls({ media: nextPlaceMedia }),
        },
        list.userId,
        progressTracker,
      )
    : previousPlaceMedia;
  const { error: placeError } = await supabase.from('list_places').upsert({
    id: place.id,
    list_id: list.id,
    created_by: place.addedBy?.userId || list.userId,
    source_list_id: place.sourceAttribution?.listId || null,
    source_place_id: place.sourceAttribution?.placeId || null,
    source_place_name: place.sourceAttribution?.placeName || null,
    source_user_avatar_url: place.sourceAttribution?.userAvatar || null,
    source_user_id: place.sourceAttribution?.userId || null,
    source_user_name: place.sourceAttribution?.userName || null,
    name: normalizedPlaceName,
    title: normalizedPlaceTitle || null,
    lat: place.lat,
    lng: place.lng,
    address: normalizedPlaceAddress || null,
    notes: normalizedPlaceNotes || null,
    rating: place.rating ?? null,
    category: place.category || null,
    categories: place.categories?.length ? uniqueStrings(place.categories) : place.category ? [place.category] : [],
    student_discount: Boolean(place.studentDiscount),
    price_range: place.priceRange ?? null,
    price_min: place.priceMin ?? null,
    price_max: place.priceMax ?? null,
    best_time: place.bestTime || null,
    best_times: place.bestTimes?.length ? uniqueStrings(place.bestTimes) : [],
    atmosphere: place.atmosphere?.length ? uniqueStrings(place.atmosphere) : [],
    special_features: place.specialFeatures?.length ? uniqueStrings(place.specialFeatures) : [],
    added_at: place.addedAt,
    updated_at: place.updatedAt || place.addedAt,
  });

  if (placeError) {
    throw placeError;
  }

  progressTracker?.advance();

  if (!shouldSyncMedia) {
    return;
  }

  const { error: deletePhotoRowsError } = await supabase
    .from('list_place_photos')
    .delete()
    .eq('list_place_id', place.id);

  if (deletePhotoRowsError) {
    throw deletePhotoRowsError;
  }

  if (!uploadedMedia.length) {
    await deleteStorageAssetsByUrls({
      bucket: 'place-media',
      urls: getPlaceStorageUrls(previousPlace),
    });
    return;
  }

  const { error: insertPhotoRowsError } = await supabase.from('list_place_photos').insert(
    uploadedMedia.map((item, index) => ({
      duration_ms: item.durationMs ?? null,
      height: item.height ?? null,
      list_place_id: place.id,
      media_type: item.type,
      mime_type: item.mimeType ?? null,
      sort_order: index,
      thumbnail_url: item.thumbnailUrl ?? null,
      url: item.url,
      width: item.width ?? null,
    })),
  );

  if (insertPhotoRowsError) {
    throw insertPhotoRowsError;
  }

  const currentStorageUrls = getPlaceStorageUrls({
    ...place,
    media: uploadedMedia,
    photos: getPlacePhotoUrls({ media: uploadedMedia }),
  });

  await deleteStorageAssetsByUrls({
    bucket: 'place-media',
    urls: getPlaceStorageUrls(previousPlace).filter(
      (url) => !currentStorageUrls.includes(url),
    ),
  });
}

async function getExistingList(listId: string, viewerId: string) {
  const context = await fetchVisibleDataContext(viewerId);
  return getExistingListFromContext(listId, viewerId, context);
}

async function getExistingListFromContext(
  listId: string,
  viewerId: string,
  context: Awaited<ReturnType<typeof fetchVisibleDataContext>>,
) {
  const lists = await fetchVisibleListsPage({
    allUsers: context.allUsers,
    blockRows: context.blockRows,
    limit: 1,
    listId,
    viewerId,
  });

  return lists[0] || null;
}

async function persistList(
  list: PlaceList,
  previousList?: PlaceList | null,
  progressTracker?: ProgressTracker,
) {
  const normalizedListName = clampTextLength(list.name, LIST_NAME_MAX_LENGTH);
  const normalizedListDescription = clampTextLength(list.description, LIST_DESCRIPTION_MAX_LENGTH);

  assertNoObjectionableContent([
    { label: tr.listEditor.titleLabel, value: normalizedListName },
    { label: tr.listEditor.descriptionLabel, value: normalizedListDescription },
  ]);

  const coverImage = await uploadImageAsset({
    bucket: 'place-media',
    userId: list.userId,
    uri: list.coverImage,
    prefix: `${list.id}/cover`,
  });

  if (list.coverImage) {
    progressTracker?.advance();
  }

  const { error: listError } = await supabase.from('lists').upsert({
    id: list.id,
    owner_id: list.userId,
    name: normalizedListName,
    description: normalizedListDescription || null,
    emoji: list.emoji || null,
    cover_image_url: coverImage || null,
    is_public: list.isPublic,
    created_at: list.createdAt,
    updated_at: list.updatedAt || new Date().toISOString(),
  });

  if (listError) {
    throw listError;
  }

  progressTracker?.advance();

  const nextPlaceIds = new Set(list.places.map((place) => place.id));
  const previousPlacesById = new Map((previousList?.places || []).map((place) => [place.id, place]));
  const removedPlaces = (previousList?.places || []).filter((place) => !nextPlaceIds.has(place.id));
  const placesToUpsert = list.places.filter((place) => {
    const previousPlace = previousPlacesById.get(place.id);
    return !previousPlace || !arePlacesEquivalentForPersistence(place, previousPlace);
  });

  if (removedPlaces.length) {
    const { error: removePlacesError } = await supabase
      .from('list_places')
      .delete()
      .in('id', removedPlaces.map((place) => place.id));

    if (removePlacesError) {
      throw removePlacesError;
    }

    await deleteStorageAssetsByUrls({
      bucket: 'place-media',
      urls: removedPlaces.flatMap((place) => getPlaceStorageUrls(place)),
    });

    progressTracker?.advance();
  }

  await Promise.all([
    Promise.all(
      placesToUpsert.map((place) =>
        upsertPlace(list, place, previousPlacesById.get(place.id), progressTracker),
      ),
    ),
    (async () => {
      await deleteStorageAssetsByUrls({
        bucket: 'place-media',
        urls:
          previousList?.coverImage && previousList.coverImage !== coverImage
            ? [previousList.coverImage]
            : [],
      });

      if (previousList?.coverImage && previousList.coverImage !== coverImage) {
        progressTracker?.advance();
      }
    })(),
  ]);
}

export async function createList(list: PlaceList) {
  await persistList({ ...list, updatedAt: list.updatedAt || new Date().toISOString() });
}

export async function updateList(list: PlaceList) {
  const previousList = await getExistingList(list.id, list.userId);
  await persistList({ ...list, updatedAt: list.updatedAt || new Date().toISOString() }, previousList);
}

export async function updateLists(
  lists: PlaceList[],
  onProgress?: (progress: number) => void,
) {
  const contextByViewerId = new Map<string, Awaited<ReturnType<typeof fetchVisibleDataContext>>>();
  const progressTracker = createProgressTracker(estimateUpdateListsUnits(lists), onProgress);

  await Promise.all(
    lists.map(async (list) => {
      let context = contextByViewerId.get(list.userId);

      if (!context) {
        context = await fetchVisibleDataContext(list.userId);
        contextByViewerId.set(list.userId, context);
      }

      const previousList = await getExistingListFromContext(list.id, list.userId, context);
      await persistList(
        { ...list, updatedAt: list.updatedAt || new Date().toISOString() },
        previousList,
        progressTracker,
      );
    }),
  );

  onProgress?.(100);
}

export async function deleteList(listId: string) {
  const { data: listRows, error: listSelectError } = await supabase
    .from('lists')
    .select('cover_image_url')
    .eq('id', listId);
  const { data: placeRows, error: placeSelectError } = await supabase
    .from('list_places')
    .select('list_place_photos ( url, thumbnail_url )')
    .eq('list_id', listId);

  if (listSelectError) {
    throw listSelectError;
  }

  if (placeSelectError) {
    throw placeSelectError;
  }

  const { error } = await supabase.from('lists').delete().eq('id', listId);

  if (error) {
    throw error;
  }

  await deleteStorageAssetsByUrls({
    bucket: 'place-media',
    urls: [
      ...(listRows || []).map((row) => row.cover_image_url),
      ...((placeRows || []) as Array<{
        list_place_photos?: Array<{ thumbnail_url?: string | null; url?: string | null }> | null;
      }>).flatMap((place) =>
        (place.list_place_photos || []).flatMap((media) => [media.url, media.thumbnail_url]),
      ),
    ].filter((value): value is string => Boolean(value)),
  });
}

export async function reportList(reporterUserId: string, listId: string, reason: string) {
  const { error } = await supabase.from('list_reports').upsert(
    {
      list_id: listId,
      reporter_user_id: reporterUserId,
      reason: reason.trim(),
      created_at: new Date().toISOString(),
    },
    { onConflict: 'list_id,reporter_user_id' },
  );

  if (error) {
    throw error;
  }
}
