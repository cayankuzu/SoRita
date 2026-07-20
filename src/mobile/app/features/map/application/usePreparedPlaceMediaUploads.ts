import { useEffect, useState } from 'react';

import type { PlaceList, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import { scheduleStorageAssetsCleanup } from '@/mobile/app/data/outbox/mediaCleanupOutbox';
import {
  isLocalPlaceMediaUri,
  preparePlaceMediaUpload,
} from '@/mobile/app/data/uploads/preparedPlaceMediaUploads';
import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import { createUuid } from '@/shared/utils/id';

type PreparedPlaceMediaUploadsParams = {
  lists: PlaceList[];
  media: PlaceMedia[];
  selectedListIds: string[];
  visible: boolean;
};

export function usePreparedPlaceMediaUploads({
  lists,
  media,
  selectedListIds,
  visible,
}: PreparedPlaceMediaUploadsParams) {
  const [preparationId] = useState(createUuid);

  useEffect(() => {
    if (!visible || getCurrentConnectionStatus() === 'offline') {
      return;
    }

    const selectedList = lists.find((list) => selectedListIds.includes(list.id));
    const userId = selectedList?.userId ?? lists[0]?.userId;

    if (!userId) {
      return;
    }

    media.forEach((item, index) => {
      if (item.type !== 'video' || !isLocalPlaceMediaUri(item.url)) {
        return;
      }

      const cleanupUpload = (storageUri: string) => scheduleStorageAssetsCleanup({
        bucket: 'place-media-private',
        urls: [storageUri],
        userId,
      });
      preparePlaceMediaUpload({
        durationMs: item.durationMs,
        height: item.height,
        mediaType: 'video',
        mimeType: item.mimeType,
        onOrphanedUpload: cleanupUpload,
        onUnusedUpload: cleanupUpload,
        prefix: `drafts/${preparationId}/${index}`,
        uri: item.url,
        userId,
        width: item.width,
      });

      if (isLocalPlaceMediaUri(item.thumbnailUrl)) {
        preparePlaceMediaUpload({
          mediaType: 'photo',
          mimeType: 'image/jpeg',
          onOrphanedUpload: cleanupUpload,
          onUnusedUpload: cleanupUpload,
          prefix: `drafts/${preparationId}/${index}-thumbnail`,
          uri: item.thumbnailUrl,
          userId,
        });
      }
    });
  }, [lists, media, preparationId, selectedListIds, visible]);
}
