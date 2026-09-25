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
  getPlacePhotoUrls,
  normalizePlaceMedia,
} from '@/mobile/app/shared/utils/placeMedia';
import { assertNoObjectionableContent } from '@/mobile/app/shared/utils/contentModeration';
import { throwIfAborted } from '@/mobile/app/shared/utils/abort';
import { mapWithConcurrency } from '@/shared/utils/mapWithConcurrency';
import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import {
  createProgressTracker,
  isPendingUploadUri,
  type ProgressTracker,
} from './listPersistenceProgress';
import {
  areListMetadataEquivalentForPersistence,
  arePlacesEquivalentForPersistence,
  areStringArraysEqual,
  buildPlaceMediaPayload,
  buildPlacePayload,
  estimateListUpdateUnits,
  estimateUpdateListsUnits,
  firstText,
  getListPlaceChanges,
  getPlaceStorageUrls,
  normalizeListDescriptionForPersistence,
  normalizeListNameForPersistence,
  normalizePlaceFields,
  normalizePlaceMenuUrlForPersistence,
  persistedText,
  resolvePlaceName,
  uniqueOrderedStrings,
} from '@/mobile/app/data/repositories/listPersistencePayload';

const MEDIA_UPLOAD_CONCURRENCY = 3;
const PLACE_WRITE_CONCURRENCY = 2;

function getMediaUploadConcurrency() {
  const status = getCurrentConnectionStatus();

  if (status === 'constrained' || status === 'offline') {
    return 1;
  }

  return status === 'online' ? MEDIA_UPLOAD_CONCURRENCY : 2;
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

async function resolveAuthenticatedListOwnerId() {
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

  throw new Error(tr.settings.sessionMissing);
}

async function resolvePersistedListOwner(list: PlaceList) {
  const ownerId = await resolveAuthenticatedListOwnerId();

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
