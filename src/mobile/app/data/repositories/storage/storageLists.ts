import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  mergeListIntoCache,
  mergeListsIntoCache,
  removeListFromCache,
} from '@/mobile/app/data/repositories/storage/storageCacheMutations';
import {
  arePlacePhotosEqual,
  isSamePlaceContent,
  uniqueStrings,
} from '@/mobile/app/data/repositories/storage/storageUtils';

type RunOptimisticMutation = <T>(
  applyOptimistic: () => void,
  task: () => Promise<T>,
  onError?: (error: unknown) => Promise<void> | void,
) => Promise<T>;

type StorageListsDependencies = {
  supabase: typeof import('@/mobile/app/platform/supabase/client').supabase;
  getListsCache: () => PlaceList[];
  setListsCache: (lists: PlaceList[]) => void;
  getCurrentViewerId: () => string | undefined;
  runOptimisticMutation: RunOptimisticMutation;
  refreshLists: (currentUserId?: string) => Promise<void>;
  uploadListCoverImage: (params: { listId: string; userId: string; coverImage?: string }) => Promise<string | undefined>;
  uploadPlacePhotos: (params: { listId: string; placeId: string; userId: string; photos?: string[] }) => Promise<string[]>;
  deleteUnreferencedPlaceMediaUrls: (urls: string[]) => Promise<void>;
  isMissingListPlaceUpdatedAtSchemaError: (
    error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
  ) => boolean;
};

export function createStorageListsRepository({
  supabase,
  getListsCache,
  setListsCache,
  getCurrentViewerId,
  runOptimisticMutation,
  refreshLists,
  uploadListCoverImage,
  uploadPlacePhotos,
  deleteUnreferencedPlaceMediaUrls,
  isMissingListPlaceUpdatedAtSchemaError,
}: StorageListsDependencies) {
  function buildPlacePayload(list: PlaceList, place: Place) {
    return {
      id: place.id,
      list_id: list.id,
      created_by: place.addedBy?.userId || list.userId,
      name: place.name,
      title: place.title || null,
      lat: place.lat,
      lng: place.lng,
      address: place.address || null,
      notes: place.notes || null,
      rating: place.rating ?? null,
      category: place.category || null,
      categories: place.categories?.length ? uniqueStrings(place.categories) : null,
      student_discount: Boolean(place.studentDiscount),
      price_range: place.priceRange ?? null,
      price_min: place.priceMin ?? null,
      price_max: place.priceMax ?? null,
      best_time: place.bestTime || null,
      best_times: place.bestTimes?.length ? uniqueStrings(place.bestTimes) : null,
      atmosphere: place.atmosphere?.length ? uniqueStrings(place.atmosphere) : null,
      special_features: place.specialFeatures?.length ? uniqueStrings(place.specialFeatures) : null,
      added_at: place.addedAt,
      updated_at: place.updatedAt || place.addedAt,
    };
  }

  async function upsertListPlace(list: PlaceList, place: Place) {
    const placePayload = buildPlacePayload(list, place);
    let { error: placeUpsertError } = await supabase.from('list_places').upsert(placePayload);

    if (placeUpsertError && isMissingListPlaceUpdatedAtSchemaError(placeUpsertError)) {
      const { updated_at: _updatedAt, ...legacyPlacePayload } = placePayload;
      ({ error: placeUpsertError } = await supabase.from('list_places').upsert(legacyPlacePayload));
    }

    if (placeUpsertError) {
      throw placeUpsertError;
    }
  }

  async function syncListPlaces(list: PlaceList, previousList?: PlaceList) {
    if (previousList) {
      const previousPlacesById = new Map(previousList.places.map((place) => [place.id, place]));
      const nextPlaceIds = new Set(list.places.map((place) => place.id));
      const removedPlaces = previousList.places.filter((place) => !nextPlaceIds.has(place.id));

      if (removedPlaces.length) {
        const { error: removePlacesError } = await supabase
          .from('list_places')
          .delete()
          .in('id', removedPlaces.map((place) => place.id));

        if (removePlacesError) {
          throw removePlacesError;
        }

        await deleteUnreferencedPlaceMediaUrls(removedPlaces.flatMap((place) => place.photos || []));
      }

      for (const place of list.places) {
        const previousPlace = previousPlacesById.get(place.id);

        if (previousPlace && isSamePlaceContent(previousPlace, place)) {
          continue;
        }

        const previousPhotoUrls = previousPlace?.photos || [];
        const nextPhotoUrls = await uploadPlacePhotos({
          listId: list.id,
          placeId: place.id,
          userId: list.userId,
          photos: place.photos,
        });

        await upsertListPlace(list, {
          ...place,
          photos: nextPhotoUrls,
        });

        const shouldResyncPhotoRows =
          !previousPlace || !arePlacePhotosEqual(previousPhotoUrls, nextPhotoUrls);

        if (shouldResyncPhotoRows) {
          const { error: deletePhotoRowsError } = await supabase
            .from('list_place_photos')
            .delete()
            .eq('list_place_id', place.id);

          if (deletePhotoRowsError) {
            throw deletePhotoRowsError;
          }

          if (nextPhotoUrls.length) {
            const { error: insertPhotoRowsError } = await supabase.from('list_place_photos').insert(
              nextPhotoUrls.map((photoUrl, index) => ({
                list_place_id: place.id,
                url: photoUrl,
                sort_order: index,
              })),
            );

            if (insertPhotoRowsError) {
              throw insertPhotoRowsError;
            }
          }

          const replacedPhotoUrls = previousPhotoUrls.filter((photoUrl) => !nextPhotoUrls.includes(photoUrl));

          if (replacedPhotoUrls.length) {
            await deleteUnreferencedPlaceMediaUrls(replacedPhotoUrls);
          }
        }
      }

      return;
    }

    const { data: existingPlacesData, error: existingPlacesError } = await supabase
      .from('list_places')
      .select('id, list_place_photos ( url )')
      .eq('list_id', list.id);

    if (existingPlacesError) {
      throw existingPlacesError;
    }

    const existingPlaces = ((existingPlacesData || []) as Array<{
      id: string;
      list_place_photos?: Array<{ url?: string | null }> | null;
    }>).map((place) => ({
      id: place.id,
      photoUrls: (place.list_place_photos || []).map((photo) => photo.url).filter(Boolean),
    }));

    const existingPlacesById = new Map(existingPlaces.map((place) => [place.id, place]));
    const nextPlaceIds = new Set(list.places.map((place) => place.id));
    const removedPlaces = existingPlaces.filter((place) => !nextPlaceIds.has(place.id));

    if (removedPlaces.length) {
      const { error: removePlacesError } = await supabase
        .from('list_places')
        .delete()
        .in('id', removedPlaces.map((place) => place.id));

      if (removePlacesError) {
        throw removePlacesError;
      }

      await deleteUnreferencedPlaceMediaUrls(removedPlaces.flatMap((place) => place.photoUrls));
    }

    for (const place of list.places) {
      const previousPlace = existingPlacesById.get(place.id);
      const previousPhotoUrls = previousPlace?.photoUrls || [];
      const nextPhotoUrls = await uploadPlacePhotos({
        listId: list.id,
        placeId: place.id,
        userId: list.userId,
        photos: place.photos,
      });

      await upsertListPlace(list, place);

      const { error: deletePhotoRowsError } = await supabase
        .from('list_place_photos')
        .delete()
        .eq('list_place_id', place.id);

      if (deletePhotoRowsError) {
        throw deletePhotoRowsError;
      }

      if (nextPhotoUrls.length) {
        const { error: insertPhotoRowsError } = await supabase.from('list_place_photos').insert(
          nextPhotoUrls.map((photoUrl, index) => ({
            list_place_id: place.id,
            url: photoUrl,
            sort_order: index,
          })),
        );

        if (insertPhotoRowsError) {
          throw insertPhotoRowsError;
        }
      }

      const replacedPhotoUrls = previousPhotoUrls.filter((photoUrl) => !nextPhotoUrls.includes(photoUrl));

      if (replacedPhotoUrls.length) {
        await deleteUnreferencedPlaceMediaUrls(replacedPhotoUrls);
      }
    }
  }

  async function persistList(list: PlaceList, previousList?: PlaceList) {
    const previousCoverImage = previousList?.coverImage;
    const nextCoverImage = await uploadListCoverImage({
      listId: list.id,
      userId: list.userId,
      coverImage: list.coverImage,
    });

    const { error: listError } = await supabase.from('lists').upsert({
      id: list.id,
      owner_id: list.userId,
      name: list.name,
      description: list.description || null,
      emoji: list.emoji || null,
      cover_image_url: nextCoverImage || null,
      is_public: list.isPublic,
      created_at: list.createdAt,
      updated_at: list.updatedAt,
    });

    if (listError) {
      throw listError;
    }

    await syncListPlaces(list, previousList);

    if (previousCoverImage && previousCoverImage !== nextCoverImage) {
      await deleteUnreferencedPlaceMediaUrls([previousCoverImage]);
    }
  }

  async function refreshViewerLists() {
    await refreshLists(getCurrentViewerId());
  }

  return {
    async createList(list: PlaceList): Promise<void> {
      const optimisticList = {
        ...list,
        updatedAt: list.updatedAt || new Date().toISOString(),
      };

      await runOptimisticMutation(
        () => {
          setListsCache(mergeListIntoCache(getListsCache(), optimisticList));
        },
        async () => {
          await persistList(optimisticList);
          await refreshViewerLists();
        },
        async () => {
          await refreshViewerLists().catch(() => undefined);
        },
      );
    },

    async updateLists(lists: PlaceList[]): Promise<void> {
      if (lists.length === 0) {
        return;
      }

      const previousListsById = new Map(
        lists.map((list) => [list.id, getListsCache().find((item) => item.id === list.id)]),
      );

      const optimisticLists = lists.map((list) => ({
        ...list,
        updatedAt: list.updatedAt || new Date().toISOString(),
      }));

      await runOptimisticMutation(
        () => {
          setListsCache(mergeListsIntoCache(getListsCache(), optimisticLists));
        },
        async () => {
          for (const list of optimisticLists) {
            await persistList(list, previousListsById.get(list.id));
          }

          await refreshViewerLists();
        },
        async () => {
          await refreshViewerLists().catch(() => undefined);
        },
      );
    },

    async updateList(list: PlaceList): Promise<void> {
      const previousList = getListsCache().find((item) => item.id === list.id);
      const optimisticList = {
        ...list,
        updatedAt: list.updatedAt || new Date().toISOString(),
      };

      await runOptimisticMutation(
        () => {
          setListsCache(mergeListIntoCache(getListsCache(), optimisticList));
        },
        async () => {
          await persistList(optimisticList, previousList);
          await refreshViewerLists();
        },
        async () => {
          await refreshViewerLists().catch(() => undefined);
        },
      );
    },

    async deleteList(listId: string): Promise<void> {
      await runOptimisticMutation(
        () => {
          setListsCache(removeListFromCache(getListsCache(), listId));
        },
        async () => {
          const [
            { data: listRows, error: listSelectError },
            { data: placeRows, error: placeSelectError },
          ] = await Promise.all([
            supabase.from('lists').select('cover_image_url').eq('id', listId),
            supabase
              .from('list_places')
              .select('list_place_photos ( url )')
              .eq('list_id', listId),
          ]);

          if (listSelectError) {
            throw listSelectError;
          }

          if (placeSelectError) {
            throw placeSelectError;
          }

          const coverImageUrls = (listRows || [])
            .map((row) => row.cover_image_url)
            .filter((value): value is string => Boolean(value));
          const placePhotoUrls = ((placeRows || []) as Array<{
            list_place_photos?: Array<{ url?: string | null }> | null;
          }>).flatMap((place) =>
            (place.list_place_photos || []).map((photo) => photo.url).filter(Boolean),
          );

          const { error } = await supabase.from('lists').delete().eq('id', listId);

          if (error) {
            throw error;
          }

          await deleteUnreferencedPlaceMediaUrls([...coverImageUrls, ...placePhotoUrls]);
          await refreshViewerLists();
        },
        async () => {
          await refreshViewerLists().catch(() => undefined);
        },
      );
    },

    async deletePlace(placeId: string): Promise<void> {
      const nextUpdatedAt = new Date().toISOString();

      await runOptimisticMutation(
        () => {
          setListsCache(
            getListsCache().map((list) => {
              if (!list.places.some((place) => place.id === placeId)) {
                return list;
              }

              return {
                ...list,
                updatedAt: nextUpdatedAt,
                places: list.places.filter((place) => place.id !== placeId),
              };
            }),
          );
        },
        async () => {
          const { data: placeRows, error: placeSelectError } = await supabase
            .from('list_places')
            .select('list_id, list_place_photos ( url )')
            .eq('id', placeId);

          if (placeSelectError) {
            throw placeSelectError;
          }

          const placeRecord = ((placeRows || []) as Array<{
            list_id: string;
            list_place_photos?: Array<{ url?: string | null }> | null;
          }>)[0];
          const targetListId = placeRecord?.list_id;
          const photoUrls = (placeRecord?.list_place_photos || [])
            .map((photo) => photo.url)
            .filter((value): value is string => Boolean(value));

          const { error: deletePlaceError } = await supabase
            .from('list_places')
            .delete()
            .eq('id', placeId);

          if (deletePlaceError) {
            throw deletePlaceError;
          }

          if (targetListId) {
            const { error: touchListError } = await supabase
              .from('lists')
              .update({ updated_at: nextUpdatedAt })
              .eq('id', targetListId);

            if (touchListError) {
              throw touchListError;
            }
          }

          await deleteUnreferencedPlaceMediaUrls(photoUrls);
          await refreshViewerLists();
        },
        async () => {
          await refreshViewerLists().catch(() => undefined);
        },
      );
    },
  };
}
