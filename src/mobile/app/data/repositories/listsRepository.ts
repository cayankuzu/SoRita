import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  fetchVisibleDataContext,
  fetchVisibleListsPage,
} from '@/mobile/app/data/repositories/visibleDataRepository';
import {
  deleteStorageAssetsByUrls,
  uploadImageAsset,
} from '@/mobile/app/platform/supabase/media';
import { supabase } from '@/mobile/app/platform/supabase/client';
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
    'Kaydedilen Mekan'
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

function arePhotoArraysEqual(left?: string[], right?: string[]) {
  const leftPhotos = left || [];
  const rightPhotos = right || [];

  if (leftPhotos.length !== rightPhotos.length) {
    return false;
  }

  return leftPhotos.every((value, index) => value === rightPhotos[index]);
}

function arePlacesEquivalentForPersistence(left: Place, right: Place) {
  return (
    left.id === right.id &&
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
    arePhotoArraysEqual(left.photos, right.photos)
  );
}

async function uploadPlacePhotos(listId: string, place: Place, userId: string) {
  const uploadedPhotos = await Promise.all(
    (place.photos || []).map(async (photoUri, index) =>
      uploadImageAsset({
        bucket: 'place-media',
        userId,
        uri: photoUri,
        prefix: `${listId}/${place.id}/${index}`,
      }),
    ),
  );

  return uploadedPhotos.filter((photoUrl): photoUrl is string => Boolean(photoUrl));
}

async function upsertPlace(list: PlaceList, place: Place, previousPlace?: Place | null) {
  const normalizedPlaceName = clampTextLength(resolvePlaceName(place), PLACE_NAME_MAX_LENGTH);
  const normalizedPlaceTitle = clampTextLength(place.title, PLACE_TITLE_MAX_LENGTH);
  const normalizedPlaceAddress = clampTextLength(place.address, PLACE_ADDRESS_MAX_LENGTH);
  const normalizedPlaceNotes = clampTextLength(place.notes, PLACE_NOTES_MAX_LENGTH);

  assertNoObjectionableContent([
    { label: 'Mekan adi', value: normalizedPlaceName },
    { label: 'Mekan basligi', value: normalizedPlaceTitle },
    { label: 'Mekan notu', value: normalizedPlaceNotes },
  ]);

  const shouldSyncPhotos = !previousPlace || !arePhotoArraysEqual(place.photos, previousPlace.photos);
  const uploadedPhotos = shouldSyncPhotos
    ? await uploadPlacePhotos(list.id, place, list.userId)
    : (previousPlace?.photos || []).filter(Boolean);
  const { error: placeError } = await supabase.from('list_places').upsert({
    id: place.id,
    list_id: list.id,
    created_by: place.addedBy?.userId || list.userId,
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

  if (!shouldSyncPhotos) {
    return;
  }

  const { error: deletePhotoRowsError } = await supabase
    .from('list_place_photos')
    .delete()
    .eq('list_place_id', place.id);

  if (deletePhotoRowsError) {
    throw deletePhotoRowsError;
  }

  if (!uploadedPhotos.length) {
    await deleteStorageAssetsByUrls({
      bucket: 'place-media',
      urls: previousPlace?.photos || [],
    });
    return;
  }

  const { error: insertPhotoRowsError } = await supabase.from('list_place_photos').insert(
    uploadedPhotos.map((url, index) => ({
      list_place_id: place.id,
      url,
      sort_order: index,
    })),
  );

  if (insertPhotoRowsError) {
    throw insertPhotoRowsError;
  }

  await deleteStorageAssetsByUrls({
    bucket: 'place-media',
    urls: (previousPlace?.photos || []).filter((url) => !uploadedPhotos.includes(url)),
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

async function persistList(list: PlaceList, previousList?: PlaceList | null) {
  const normalizedListName = clampTextLength(list.name, LIST_NAME_MAX_LENGTH);
  const normalizedListDescription = clampTextLength(list.description, LIST_DESCRIPTION_MAX_LENGTH);

  assertNoObjectionableContent([
    { label: 'Liste adi', value: normalizedListName },
    { label: 'Liste aciklamasi', value: normalizedListDescription },
  ]);

  const coverImage = await uploadImageAsset({
    bucket: 'place-media',
    userId: list.userId,
    uri: list.coverImage,
    prefix: `${list.id}/cover`,
  });

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
      urls: removedPlaces.flatMap((place) => place.photos || []),
    });
  }

  await Promise.all([
    Promise.all(
      placesToUpsert.map((place) => upsertPlace(list, place, previousPlacesById.get(place.id))),
    ),
    deleteStorageAssetsByUrls({
      bucket: 'place-media',
      urls: [
        previousList?.coverImage && previousList.coverImage !== coverImage
          ? previousList.coverImage
          : undefined,
      ],
    }),
  ]);
}

export async function createList(list: PlaceList) {
  await persistList({ ...list, updatedAt: list.updatedAt || new Date().toISOString() });
}

export async function updateList(list: PlaceList) {
  const previousList = await getExistingList(list.id, list.userId);
  await persistList({ ...list, updatedAt: list.updatedAt || new Date().toISOString() }, previousList);
}

export async function updateLists(lists: PlaceList[]) {
  const contextByViewerId = new Map<string, Awaited<ReturnType<typeof fetchVisibleDataContext>>>();

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
      );
    }),
  );
}

export async function deleteList(listId: string) {
  const { data: listRows, error: listSelectError } = await supabase
    .from('lists')
    .select('cover_image_url')
    .eq('id', listId);
  const { data: placeRows, error: placeSelectError } = await supabase
    .from('list_places')
    .select('list_place_photos ( url )')
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
      ...((placeRows || []) as Array<{ list_place_photos?: Array<{ url?: string | null }> | null }>)
        .flatMap((place) => (place.list_place_photos || []).map((photo) => photo.url)),
    ],
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
