import { deleteStorageAssetsByUrls, uploadImageAsset } from '@/mobile/app/platform/supabase/media';
import { isLocalMediaUri, uniqueStrings } from '@/mobile/app/data/repositories/storage/storageUtils';

type StorageMediaDependencies = {
  supabase: typeof import('@/mobile/app/platform/supabase/client').supabase;
};

type RepairableListRecord = {
  id: string;
  owner_id: string;
  cover_image_url?: string | null;
  updated_at: string;
};

export function createStorageMediaRepository({ supabase }: StorageMediaDependencies) {
  async function getUnreferencedPlaceMediaUrls(urls: string[]) {
    const normalizedUrls = uniqueStrings(urls.filter(Boolean));

    if (!normalizedUrls.length) {
      return [];
    }

    const [{ data: listCoverRows, error: listCoverError }, { data: placePhotoRows, error: placePhotoError }] =
      await Promise.all([
        supabase.from('lists').select('cover_image_url').in('cover_image_url', normalizedUrls),
        supabase.from('list_place_photos').select('url').in('url', normalizedUrls),
      ]);

    if (listCoverError) {
      throw listCoverError;
    }

    if (placePhotoError) {
      throw placePhotoError;
    }

    const referencedUrls = new Set<string>();

    for (const row of listCoverRows || []) {
      if (row.cover_image_url) {
        referencedUrls.add(row.cover_image_url);
      }
    }

    for (const row of placePhotoRows || []) {
      if (row.url) {
        referencedUrls.add(row.url);
      }
    }

    return normalizedUrls.filter((url) => !referencedUrls.has(url));
  }

  async function getUnreferencedProfileMediaUrls(urls: string[]) {
    const normalizedUrls = uniqueStrings(urls.filter(Boolean));

    if (!normalizedUrls.length) {
      return [];
    }

    const [
      { data: profilePhotoRows, error: profilePhotoError },
      { data: coverPhotoRows, error: coverPhotoError },
    ] = await Promise.all([
      supabase.from('profiles').select('profile_photo_url').in('profile_photo_url', normalizedUrls),
      supabase.from('profiles').select('cover_photo_url').in('cover_photo_url', normalizedUrls),
    ]);

    if (profilePhotoError) {
      throw profilePhotoError;
    }

    if (coverPhotoError) {
      throw coverPhotoError;
    }

    const referencedUrls = new Set<string>();

    for (const row of profilePhotoRows || []) {
      if (row.profile_photo_url) {
        referencedUrls.add(row.profile_photo_url);
      }
    }

    for (const row of coverPhotoRows || []) {
      if (row.cover_photo_url) {
        referencedUrls.add(row.cover_photo_url);
      }
    }

    return normalizedUrls.filter((url) => !referencedUrls.has(url));
  }

  return {
    async uploadUserMedia(userId: string, profilePhoto?: string, coverPhoto?: string) {
      const [nextProfilePhoto, nextCoverPhoto] = await Promise.all([
        uploadImageAsset({ bucket: 'profile-media', userId, uri: profilePhoto, prefix: 'profile' }),
        uploadImageAsset({ bucket: 'profile-media', userId, uri: coverPhoto, prefix: 'cover' }),
      ]);

      return {
        profilePhoto: nextProfilePhoto,
        coverPhoto: nextCoverPhoto,
      };
    },

    async uploadListCoverImage(params: { listId: string; userId: string; coverImage?: string }) {
      return uploadImageAsset({
        bucket: 'place-media',
        userId: params.userId,
        uri: params.coverImage,
        prefix: `${params.listId}-cover`,
      });
    },

    async uploadPlacePhotos(params: {
      listId: string;
      placeId: string;
      userId: string;
      photos?: string[];
    }) {
      const uploaded = await Promise.all(
        (params.photos || []).map((photo, index) =>
          uploadImageAsset({
            bucket: 'place-media',
            userId: params.userId,
            uri: photo,
            prefix: `${params.listId}-${params.placeId}-${index}`,
          }),
        ),
      );

      return uploaded.filter((photo): photo is string => Boolean(photo));
    },

    async deleteUnreferencedPlaceMediaUrls(urls: string[]) {
      const deletableUrls = await getUnreferencedPlaceMediaUrls(urls);

      if (!deletableUrls.length) {
        return;
      }

      await deleteStorageAssetsByUrls({
        bucket: 'place-media',
        urls: deletableUrls,
      });
    },

    async deleteUnreferencedProfileMediaUrls(urls: string[]) {
      const deletableUrls = await getUnreferencedProfileMediaUrls(urls);

      if (!deletableUrls.length) {
        return;
      }

      await deleteStorageAssetsByUrls({
        bucket: 'profile-media',
        urls: deletableUrls,
      });
    },

    async repairListCoverImage<T extends RepairableListRecord>(list: T): Promise<T> {
      if (!isLocalMediaUri(list.cover_image_url)) {
        return list;
      }

      try {
        const nextCoverImage = await uploadImageAsset({
          bucket: 'place-media',
          userId: list.owner_id,
          uri: list.cover_image_url ?? undefined,
          prefix: `${list.id}-cover-repair`,
        });

        if (!nextCoverImage || isLocalMediaUri(nextCoverImage)) {
          return list;
        }

        const nextUpdatedAt = new Date().toISOString();
        const { error } = await supabase
          .from('lists')
          .update({
            cover_image_url: nextCoverImage,
            updated_at: nextUpdatedAt,
          })
          .eq('id', list.id);

        if (error) {
          return list;
        }

        return {
          ...list,
          cover_image_url: nextCoverImage,
          updated_at: nextUpdatedAt,
        } as T;
      } catch {
        return list;
      }
    },
  };
}
