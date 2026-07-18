import type { Place, PlaceList, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import {
  fetchVisibleDataContext,
  fetchVisibleListsPage,
} from '@/mobile/app/data/repositories/visibleDataRepository';
import { submitModerationReport } from '@/mobile/app/data/repositories/moderationReports';
import {
  deleteStorageAssetsByUrls,
  uploadImageAsset,
  uploadPlaceMediaAsset,
} from '@/mobile/app/platform/supabase/media';
import { generateVideoThumbnailUri } from '@/mobile/app/platform/media/videoThumbnails';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  arePlaceMediaArraysEqual,
  getPlaceMedia,
  getPlacePhotoUrls,
  normalizePlaceMedia,
} from '@/mobile/app/shared/utils/placeMedia';
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
import { throwIfAborted } from '@/mobile/app/shared/utils/abort';

function isPendingUploadUri(value?: string | null) {
  return Boolean(value && (value.startsWith('file://') || value.startsWith('content://')));
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
    left.menuUrl === right.menuUrl &&
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

function normalizeListNameForPersistence(value: string) {
  return clampTextLength(value, LIST_NAME_MAX_LENGTH).trim();
}

function normalizeListDescriptionForPersistence(value?: string) {
  return (
    trimPreservingLineBreaks(
      clampMultilineTextLength(value, LIST_DESCRIPTION_MAX_LENGTH),
    ) || null
  );
}

function normalizePlaceMenuUrlForPersistence(value?: string) {
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

function areListMetadataEquivalentForPersistence(
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
      (total, place) =>
        total +
        getPlaceMedia(place).reduce(
          (mediaTotal, item) =>
            mediaTotal +
            (item.url ? 1 : 0) +
            (isPendingUploadUri(item.thumbnailUrl) ? 1 : 0),
          0,
        ),
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

async function resolveAuthenticatedListOwnerId(fallbackUserId?: string) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const authenticatedUserId = session?.user?.id?.trim();

  if (authenticatedUserId) {
    return authenticatedUserId;
  }

  const normalizedFallbackUserId = fallbackUserId?.trim();

  if (normalizedFallbackUserId) {
    return normalizedFallbackUserId;
  }

  throw new Error(tr.settings.sessionMissing);
}

async function resolvePersistedListOwner(list: PlaceList) {
  const ownerId = await resolveAuthenticatedListOwnerId(list.userId);

  if (ownerId === list.userId) {
    return list;
  }

  return {
    ...list,
    userId: ownerId,
  };
}

async function uploadPlaceMedia(
  listId: string,
  place: Place,
  userId: string,
  progressTracker?: ProgressTracker,
  signal?: AbortSignal,
) {
  const uploadedMedia: PlaceMedia[] = [];
  const uploadedStorageUrls: string[] = [];
  const nextMedia = normalizePlaceMedia(place.media, place.photos);

  for (const [index, item] of nextMedia.entries()) {
    throwIfAborted(signal);
    const shouldUploadMedia = isPendingUploadUri(item.url);
    const uploadedUrl = shouldUploadMedia
      ? await uploadPlaceMediaAsset({
          mimeType: item.mimeType,
          prefix: `${listId}/${place.id}/${index}`,
          signal,
          uri: item.url,
          userId,
        }).finally(() => {
          progressTracker?.advance();
        })
      : (() => {
          progressTracker?.advance();
          return item.url;
        })();
    if (shouldUploadMedia && uploadedUrl) {
      uploadedStorageUrls.push(uploadedUrl);
    }
    const thumbnailSource =
      !item.thumbnailUrl && item.type === 'video' && typeof item.thumbnailTimeMs === 'number'
        ? await generateVideoThumbnailUri(item.url, item.thumbnailTimeMs)
        : item.thumbnailUrl;
    throwIfAborted(signal);
    const shouldUploadThumbnail = isPendingUploadUri(thumbnailSource);
    const uploadedThumbnailUrl = shouldUploadThumbnail
      ? await uploadPlaceMediaAsset({
          mimeType: 'image/jpeg',
          prefix: `${listId}/${place.id}/${index}-thumbnail`,
          signal,
          uri: thumbnailSource,
          userId,
        }).finally(() => {
          progressTracker?.advance();
        })
      : thumbnailSource;
    if (shouldUploadThumbnail && uploadedThumbnailUrl) {
      uploadedStorageUrls.push(uploadedThumbnailUrl);
    }

    uploadedMedia.push({
      ...item,
      thumbnailUrl: uploadedThumbnailUrl || undefined,
      url: uploadedUrl || item.url,
    });
  }

  return { media: uploadedMedia, uploadedStorageUrls };
}

async function upsertPlace(
  list: PlaceList,
  place: Place,
  previousPlace?: Place | null,
  progressTracker?: ProgressTracker,
  signal?: AbortSignal,
) {
  const normalizedPlaceName = clampTextLength(resolvePlaceName(place), PLACE_NAME_MAX_LENGTH);
  const normalizedPlaceTitle = clampMultilineTextLength(place.title, PLACE_TITLE_MAX_LENGTH);
  const normalizedPlaceMenuUrl = normalizePlaceMenuUrlForPersistence(place.menuUrl);
  const normalizedPlaceAddress = clampTextLength(place.address, PLACE_ADDRESS_MAX_LENGTH);
  const normalizedPlaceNotes = clampMultilineTextLength(place.notes, PLACE_NOTES_MAX_LENGTH);

  assertNoObjectionableContent([
    { label: tr.moderation.placeNameField, value: normalizedPlaceName },
    { label: tr.moderation.placeTitleField, value: normalizedPlaceTitle },
    { label: tr.moderation.placeNoteField, value: normalizedPlaceNotes },
  ]);

  const nextPlaceMedia = normalizePlaceMedia(place.media, place.photos);
  const previousPlaceMedia = normalizePlaceMedia(previousPlace?.media, previousPlace?.photos);
  const shouldSyncMedia = !previousPlace || !arePlaceMediaArraysEqual(nextPlaceMedia, previousPlaceMedia);
  const mediaUploadResult = shouldSyncMedia
    ? await uploadPlaceMedia(
        list.id,
        {
          ...place,
          media: nextPlaceMedia,
          photos: getPlacePhotoUrls({ media: nextPlaceMedia }),
        },
        list.userId,
        progressTracker,
        signal,
      )
    : { media: previousPlaceMedia, uploadedStorageUrls: [] };
  const uploadedMedia = mediaUploadResult.media;
  const uploadedStorageUrls = mediaUploadResult.uploadedStorageUrls;
  let mediaRowsCommitted = !shouldSyncMedia;
  throwIfAborted(signal);

  try {
    const placePayload = {
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
      title: encodePersistedLineBreaks(trimPreservingLineBreaks(normalizedPlaceTitle)) || null,
      menu_url: normalizedPlaceMenuUrl,
      lat: place.lat,
      lng: place.lng,
      address: normalizedPlaceAddress || null,
      notes: encodePersistedLineBreaks(trimPreservingLineBreaks(normalizedPlaceNotes)) || null,
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
    };
    const mediaPayload = uploadedMedia.map((item) => ({
      durationMs: item.durationMs ?? null,
      height: item.height ?? null,
      id: item.id ?? null,
      mimeType: item.mimeType ?? null,
      thumbnailUrl: item.thumbnailUrl ?? null,
      type: item.type,
      url: item.url,
      width: item.width ?? null,
    }));
    const { error: upsertPlaceWithMediaError } = await supabase.rpc(
      'upsert_list_place_with_media',
      {
        p_media: mediaPayload,
        p_place: placePayload,
      },
    );

    if (upsertPlaceWithMediaError) {
      throw upsertPlaceWithMediaError;
    }

    mediaRowsCommitted = true;
    progressTracker?.advance();

    if (!shouldSyncMedia) {
      return;
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
  } catch (error) {
    if (uploadedStorageUrls.length && !mediaRowsCommitted) {
      await deleteStorageAssetsByUrls({
        bucket: 'place-media',
        urls: uploadedStorageUrls,
      }).catch(() => undefined);
    }

    throw error;
  }
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
  options?: { insertOnly?: boolean },
  signal?: AbortSignal,
) {
  const normalizedListName = normalizeListNameForPersistence(list.name);
  const normalizedListDescription = normalizeListDescriptionForPersistence(list.description);

  assertNoObjectionableContent([
    { label: tr.listEditor.titleLabel, value: normalizedListName },
    { label: tr.listEditor.descriptionLabel, value: normalizedListDescription },
  ]);

  throwIfAborted(signal);
  const shouldUploadCoverImage = isPendingUploadUri(list.coverImage);
  const coverImage = await uploadImageAsset({
    bucket: 'place-media',
    signal,
    userId: list.userId,
    uri: list.coverImage,
    prefix: `${list.id}/cover`,
  });

  if (list.coverImage) {
    progressTracker?.advance();
  }

  const shouldWriteListRow =
    Boolean(options?.insertOnly) ||
    !previousList ||
    !areListMetadataEquivalentForPersistence(list, previousList, coverImage);

  if (shouldWriteListRow) {
    throwIfAborted(signal);
    const listRow = {
      id: list.id,
      owner_id: list.userId,
      name: normalizedListName,
      description:
        encodePersistedLineBreaks(normalizedListDescription) || null,
      emoji: list.emoji || null,
      cover_image_url: coverImage || null,
      is_public: list.isPublic,
      created_at: list.createdAt,
      updated_at: list.updatedAt || new Date().toISOString(),
    };
    const listWriteQuery = options?.insertOnly
      ? supabase.from('lists').insert(listRow)
      : supabase.from('lists').upsert(listRow);
    const { error: listError } = await listWriteQuery;

    if (listError) {
      if (shouldUploadCoverImage && coverImage) {
        await deleteStorageAssetsByUrls({
          bucket: 'place-media',
          urls: [coverImage],
        }).catch(() => undefined);
      }

      throw listError;
    }
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
    throwIfAborted(signal);
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

  for (const place of placesToUpsert) {
    await upsertPlace(list, place, previousPlacesById.get(place.id), progressTracker, signal);
  }

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
}

export async function createList(list: PlaceList) {
  const normalizedList = await resolvePersistedListOwner(list);
  await persistList(
    { ...normalizedList, updatedAt: normalizedList.updatedAt || new Date().toISOString() },
    undefined,
    undefined,
    { insertOnly: true },
  );
}

export async function updateList(list: PlaceList) {
  const normalizedList = await resolvePersistedListOwner(list);
  const previousList = await getExistingList(normalizedList.id, normalizedList.userId);
  await persistList(
    { ...normalizedList, updatedAt: normalizedList.updatedAt || new Date().toISOString() },
    previousList,
  );
}

export async function updateLists(
  lists: PlaceList[],
  onProgress?: (progress: number) => void,
  abortSignal?: AbortSignal,
) {
  const contextByViewerId = new Map<string, Awaited<ReturnType<typeof fetchVisibleDataContext>>>();
  const progressTracker = createProgressTracker(estimateUpdateListsUnits(lists), onProgress);

  for (const currentList of lists) {
    throwIfAborted(abortSignal);
    const list = await resolvePersistedListOwner(currentList);
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
      undefined,
      abortSignal,
    );
  }

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

export async function reportList(
  reporterUserId: string,
  listId: string,
  reason: string,
  details?: string,
) {
  await submitModerationReport({
    targetType: 'list',
    reporterUserId,
    listId,
    reason,
    details,
  });
}
