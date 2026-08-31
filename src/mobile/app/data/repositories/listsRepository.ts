import type { Place, PlaceList, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import {
  deleteStorageAssetsWithRetry,
  scheduleStorageAssetsCleanup,
} from '@/mobile/app/data/outbox/mediaCleanupOutbox';
import {
  fetchVisibleDataContext,
  fetchVisibleListsPage,
} from '@/mobile/app/data/repositories/visibleDataRepository';
import { submitModerationReport } from '@/mobile/app/data/repositories/moderationReports';
import {
  isPublicPlaceMediaAsset,
  rehomePublicPlaceMediaAssetToPrivate,
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
import { mapWithConcurrency } from '@/shared/utils/mapWithConcurrency';
import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import {
  createProgressTracker,
  estimateListUpdateUnits as calculateListUpdateUnits,
  estimateUpdateListsUnits as calculateUpdateListsUnits,
  getListPlaceChanges as calculateListPlaceChanges,
  isPendingUploadUri,
  type ProgressTracker,
} from './listPersistenceProgress';

const MEDIA_UPLOAD_CONCURRENCY = 3;
const PLACE_WRITE_CONCURRENCY = 2;

function getMediaUploadConcurrency() {
  const status = getCurrentConnectionStatus();

  if (status === 'constrained' || status === 'offline') {
    return 1;
  }

  return status === 'online' ? MEDIA_UPLOAD_CONCURRENCY : 2;
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

const persistedPlaceFields = [
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

const persistedSourceFields = [
  'listId',
  'placeId',
  'placeName',
  'userAvatar',
  'userId',
  'userName',
] as const satisfies ReadonlyArray<keyof NonNullable<Place['sourceAttribution']>>;

function arePlacesEquivalentForPersistence(left: Place, right: Place) {
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

function getListPlaceChanges(list: PlaceList, previousList?: PlaceList | null) {
  return calculateListPlaceChanges(list, previousList, arePlacesEquivalentForPersistence);
}

function estimateListUpdateUnits(list: PlaceList, previousList?: PlaceList | null) {
  return calculateListUpdateUnits(list, previousList, getListPlaceChanges);
}

function estimateUpdateListsUnits(lists: PlaceList[], previousLists?: PlaceList[]) {
  return calculateUpdateListsUnits(lists, previousLists, getListPlaceChanges);
}

function getPlaceStorageUrls(place?: Place | null) {
  return getPlaceMedia(place).flatMap((item) =>
    [item.url, item.thumbnailUrl].filter((value): value is string => Boolean(value)),
  );
}

function unwrapSettledUpload<T>(result: PromiseSettledResult<T>) {
  if (result.status === 'rejected') {
    throw result.reason;
  }

  return result.value;
}

// These comparisons control whether an edit performs database/media writes or
// remains a no-op, so expose one narrow surface for deterministic regression tests.
export const listsRepositoryInternals = {
  areListMetadataEquivalentForPersistence,
  arePlacesEquivalentForPersistence,
  areStringArraysEqual,
  createProgressTracker,
  estimateListUpdateUnits,
  estimateUpdateListsUnits,
  getPlaceStorageUrls,
  isPendingUploadUri,
  normalizeListDescriptionForPersistence,
  normalizeListNameForPersistence,
  normalizePlaceMenuUrlForPersistence,
  resolvePlaceName,
  uniqueOrderedStrings,
};

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
  const nextMedia = normalizePlaceMedia(place.media, place.photos);
  const completedStorageUrls: string[] = [];

  try {
    const uploadResults = await mapWithConcurrency(
      nextMedia,
      getMediaUploadConcurrency(),
      async (item, index) => {
        throwIfAborted(signal);
        const shouldUploadMedia = isPendingUploadUri(item.url);
        const mediaProgressKey = `${place.id}:${index}:media`;
        const mediaUpload = shouldUploadMedia
          ? uploadPlaceMediaAsset({
              durationMs: item.durationMs,
              height: item.height,
              mediaType: item.type,
              mimeType: item.mimeType,
              onProgress: ({ sentBytes, totalBytes }) => {
                progressTracker?.setUnitProgress(
                  mediaProgressKey,
                  totalBytes > 0 ? sentBytes / totalBytes : 0,
                );
              },
              onOrphanedUpload: (storageUri) =>
                deleteStorageAssetsWithRetry({
                  bucket: 'place-media-private',
                  urls: [storageUri],
                  userId,
                }),
              prefix: `${listId}/${place.id}/${index}`,
              signal,
              uri: item.url,
              userId,
              width: item.width,
            }).finally(() => {
              progressTracker?.completeUnit(mediaProgressKey);
            })
          : (() => {
              progressTracker?.advance();
              return item.url;
            })();

        const thumbnailSourcePromise =
          !item.thumbnailUrl && item.type === 'video' && typeof item.thumbnailTimeMs === 'number'
            ? generateVideoThumbnailUri(item.url, item.thumbnailTimeMs)
            : Promise.resolve(item.thumbnailUrl);
        const thumbnailProgressKey = `${place.id}:${index}:thumbnail`;
        const thumbnailUpload = thumbnailSourcePromise.then((thumbnailSource) => {
          throwIfAborted(signal);

          return isPendingUploadUri(thumbnailSource)
            ? uploadPlaceMediaAsset({
                mediaType: 'photo',
                mimeType: 'image/jpeg',
                onProgress: ({ sentBytes, totalBytes }) => {
                  progressTracker?.setUnitProgress(
                    thumbnailProgressKey,
                    totalBytes > 0 ? sentBytes / totalBytes : 0,
                  );
                },
                onOrphanedUpload: (storageUri) =>
                  deleteStorageAssetsWithRetry({
                    bucket: 'place-media-private',
                    urls: [storageUri],
                    userId,
                  }),
                prefix: `${listId}/${place.id}/${index}-thumbnail`,
                signal,
                uri: thumbnailSource,
                userId,
              }).finally(() => {
                progressTracker?.completeUnit(thumbnailProgressKey);
              })
            : thumbnailSource;
        });
        const [mediaResult, thumbnailResult] = await Promise.allSettled([
          mediaUpload,
          thumbnailUpload,
        ]);

        if (mediaResult.status === 'fulfilled' && shouldUploadMedia && mediaResult.value) {
          completedStorageUrls.push(mediaResult.value);
        }
        const thumbnailSource = await thumbnailSourcePromise;
        const shouldUploadThumbnail = isPendingUploadUri(thumbnailSource);
        if (
          thumbnailResult.status === 'fulfilled' &&
          shouldUploadThumbnail &&
          thumbnailResult.value
        ) {
          completedStorageUrls.push(thumbnailResult.value);
        }
        const uploadedUrl = unwrapSettledUpload(mediaResult);
        const uploadedThumbnailUrl = unwrapSettledUpload(thumbnailResult);

        return {
          media: {
            ...item,
            thumbnailUrl: uploadedThumbnailUrl || undefined,
            url: uploadedUrl || item.url,
          } satisfies PlaceMedia,
        };
      },
    );

    return {
      media: uploadResults.map((result) => result.media),
      uploadedStorageUrls: completedStorageUrls,
    };
  } catch (error) {
    if (completedStorageUrls.length > 0) {
      await deleteStorageAssetsWithRetry({
        bucket: 'place-media-private',
        urls: completedStorageUrls,
        userId,
      });
    }

    throw error;
  }
}

function normalizePlaceFields(place: Place) {
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

function nullable<T>(value: T | null | undefined) {
  return value ?? null;
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find(Boolean) || null;
}

function persistedText(value?: string | null) {
  return firstText(encodePersistedLineBreaks(trimPreservingLineBreaks(value)));
}

function persistedStrings(values?: string[], fallback?: string) {
  return uniqueStrings(values?.length ? values : fallback ? [fallback] : []);
}

function buildPlacePayload(
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

function buildPlaceMediaPayload(media: PlaceMedia[]) {
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

async function upsertPlace(
  list: PlaceList,
  place: Place,
  previousPlace?: Place | null,
  progressTracker?: ProgressTracker,
  signal?: AbortSignal,
) {
  const normalizedFields = normalizePlaceFields(place);
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
    const placePayload = buildPlacePayload(list, place, normalizedFields);
    const mediaPayload = buildPlaceMediaPayload(uploadedMedia);
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

    scheduleStorageAssetsCleanup({
      bucket: 'place-media',
      urls: getPlaceStorageUrls(previousPlace).filter(
        (url) => !currentStorageUrls.includes(url),
      ),
      userId: list.userId,
    });
  } catch (error) {
    if (uploadedStorageUrls.length && !mediaRowsCommitted) {
      await deleteStorageAssetsWithRetry({
        bucket: 'place-media',
        urls: uploadedStorageUrls,
        userId: list.userId,
      });
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

async function writeListMetadata(params: {
  coverImage?: string | null;
  insertOnly: boolean;
  list: PlaceList;
  normalizedDescription: string | null;
  normalizedName: string;
  previousList?: PlaceList | null;
  uploadedCoverImage: boolean;
  signal?: AbortSignal;
}) {
  const shouldWrite =
    params.insertOnly ||
    !params.previousList ||
    !areListMetadataEquivalentForPersistence(
      params.list,
      params.previousList,
      params.coverImage,
    );

  if (!shouldWrite) {
    return;
  }

  throwIfAborted(params.signal);
  const listRow = {
    id: params.list.id,
    owner_id: params.list.userId,
    name: params.normalizedName,
    description: persistedText(params.normalizedDescription),
    emoji: firstText(params.list.emoji),
    cover_image_url: firstText(params.coverImage),
    is_public: params.list.isPublic,
    created_at: params.list.createdAt,
    updated_at: firstText(params.list.updatedAt, new Date().toISOString()),
  };
  const query = params.insertOnly
    ? supabase.from('lists').insert(listRow)
    : supabase.from('lists').upsert(listRow);
  const { error } = await query;

  if (!error) {
    return;
  }

  if (params.uploadedCoverImage && params.coverImage) {
    await deleteStorageAssetsWithRetry({
      bucket: params.coverImage.startsWith('sorita-storage://place-media-private/')
        ? 'place-media-private'
        : 'place-media',
      urls: [params.coverImage],
      userId: params.list.userId,
    });
  }

  throw error;
}

async function removeListPlaces(
  list: PlaceList,
  places: Place[],
  progressTracker?: ProgressTracker,
  signal?: AbortSignal,
) {
  if (places.length === 0) {
    return;
  }

  throwIfAborted(signal);
  const { error } = await supabase
    .from('list_places')
    .delete()
    .in('id', places.map((place) => place.id));

  if (error) {
    throw error;
  }

  scheduleStorageAssetsCleanup({
    bucket: 'place-media',
    urls: places.flatMap((place) => getPlaceStorageUrls(place)),
    userId: list.userId,
  });
  progressTracker?.advance();
}

function removeReplacedCoverImage(
  list: PlaceList,
  previousList: PlaceList | null | undefined,
  coverImage: string | null | undefined,
  progressTracker?: ProgressTracker,
  preservePreviousPublicCover = false,
) {
  const oldCoverImage = previousList?.coverImage;
  const shouldRemove = Boolean(oldCoverImage && oldCoverImage !== coverImage);
  const shouldDeleteNow = shouldRemove && !preservePreviousPublicCover;

  scheduleStorageAssetsCleanup({
    bucket: oldCoverImage?.startsWith('sorita-storage://place-media-private/')
      ? 'place-media-private'
      : 'place-media',
    // A legacy public object can be referenced by more than one list. The
    // authenticated client cannot see every private reference, so rehome
    // sources are retained for the service-role, reference-counted GC.
    urls: shouldDeleteNow && oldCoverImage ? [oldCoverImage] : [],
    userId: list.userId,
  });

  if (shouldRemove) {
    progressTracker?.advance();
  }
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
  const shouldRehomePublicCover =
    !list.isPublic &&
    !shouldUploadCoverImage &&
    isPublicPlaceMediaAsset(list.coverImage);
  const coverImage = shouldUploadCoverImage
    ? await (list.isPublic
        ? uploadImageAsset({
            bucket: 'place-media',
            signal,
            userId: list.userId,
            uri: list.coverImage,
            prefix: `${list.id}/cover`,
          })
        : uploadPlaceMediaAsset({
            mediaType: 'photo',
            prefix: `${list.id}/cover`,
            signal,
            uri: list.coverImage,
            userId: list.userId,
          }))
    : shouldRehomePublicCover && list.coverImage
      ? await rehomePublicPlaceMediaAssetToPrivate({
          prefix: `${list.id}/cover`,
          signal,
          uri: list.coverImage,
          userId: list.userId,
        })
    : list.coverImage;

  if (list.coverImage) {
    progressTracker?.advance();
  }

  await writeListMetadata({
    coverImage,
    insertOnly: Boolean(options?.insertOnly),
    list,
    normalizedDescription: normalizedListDescription,
    normalizedName: normalizedListName,
    previousList,
    uploadedCoverImage: shouldUploadCoverImage || shouldRehomePublicCover,
    signal,
  });

  progressTracker?.advance();

  const { placesToUpsert, previousPlacesById, removedPlaces } =
    getListPlaceChanges(list, previousList);
  await removeListPlaces(list, removedPlaces, progressTracker, signal);

  await mapWithConcurrency(
    placesToUpsert,
    PLACE_WRITE_CONCURRENCY,
    (place) => upsertPlace(
      list,
      place,
      previousPlacesById.get(place.id),
      progressTracker,
      signal,
    ),
  );

  removeReplacedCoverImage(
    list,
    previousList,
    coverImage,
    progressTracker,
    shouldRehomePublicCover,
  );
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

export async function updateList(list: PlaceList, previousList?: PlaceList | null) {
  const normalizedList = await resolvePersistedListOwner(list);
  const persistedPreviousList = previousList ?? await getExistingList(
    normalizedList.id,
    normalizedList.userId,
  );
  await persistList(
    { ...normalizedList, updatedAt: normalizedList.updatedAt || new Date().toISOString() },
    persistedPreviousList,
  );
}

export async function updateLists(
  lists: PlaceList[],
  onProgress?: (progress: number) => void,
  abortSignal?: AbortSignal,
  previousLists?: PlaceList[],
) {
  const contextByViewerId = new Map<string, Awaited<ReturnType<typeof fetchVisibleDataContext>>>();
  const previousListsById = new Map(previousLists?.map((list) => [list.id, list]) ?? []);
  const progressTracker = createProgressTracker(
    estimateUpdateListsUnits(lists, previousLists),
    onProgress,
  );

  for (const currentList of lists) {
    throwIfAborted(abortSignal);
    const list = await resolvePersistedListOwner(currentList);
    let previousList = previousListsById.get(list.id);

    if (!previousList) {
      let context = contextByViewerId.get(list.userId);

      if (!context) {
        context = await fetchVisibleDataContext(list.userId);
        contextByViewerId.set(list.userId, context);
      }

      previousList = await getExistingListFromContext(list.id, list.userId, context) ?? undefined;
    }
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
    .select('cover_image_url, owner_id')
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

  const cleanupUrls = [
    ...(listRows || []).map((row) => row.cover_image_url),
    ...((placeRows || []) as Array<{
      list_place_photos?: Array<{ thumbnail_url?: string | null; url?: string | null }> | null;
    }>).flatMap((place) =>
      (place.list_place_photos || []).flatMap((media) => [media.url, media.thumbnail_url]),
    ),
  ].filter((value): value is string => Boolean(value));
  const ownerId = listRows?.[0]?.owner_id;

  if (ownerId) {
    scheduleStorageAssetsCleanup({
      bucket: 'place-media',
      urls: cleanupUrls,
      userId: ownerId,
    });
  }
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
