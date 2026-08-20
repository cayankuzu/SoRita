import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { PlaceMedia } from '@/mobile/app/data/contracts/entities';
import {
  MAX_PLACE_MEDIA_ITEMS,
  MAX_PLACE_PHOTOS,
  MAX_PLACE_VIDEOS,
} from '@/mobile/app/features/map/catalog/placeEditor';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { pickPlaceMediaFromPrompt } from '@/mobile/app/platform/media/images';
import { waitForMediaPickerTransition } from '@/mobile/app/platform/media/mediaPickerTransition';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getPlaceMediaCounts } from '@/mobile/app/shared/utils/placeMedia';
import { swapPhotos } from '@/mobile/app/features/map/application/placeEditorStateUtils';

export type MediaSelectionIssueSummary = {
  rejectedPhotos: number;
  rejectedTotal: number;
  rejectedVideos: number;
};

type UsePlaceEditorMediaControllerParams = {
  media: PlaceMedia[];
  setMedia: Dispatch<SetStateAction<PlaceMedia[]>>;
  showSelectionFeedback: (
    issues: MediaSelectionIssueSummary,
    rejectedVideoDurationCount?: number,
    rejectedOversizeCount?: number,
  ) => void;
};

export function appendPlaceMediaWithinLimits(
  currentMedia: PlaceMedia[],
  incomingMedia: PlaceMedia[],
) {
  const nextMedia = [...currentMedia];
  const issues: MediaSelectionIssueSummary = {
    rejectedPhotos: 0,
    rejectedTotal: 0,
    rejectedVideos: 0,
  };

  for (const item of incomingMedia) {
    const counts = getPlaceMediaCounts(nextMedia);

    if (item.type === 'video' && counts.videos >= MAX_PLACE_VIDEOS) {
      issues.rejectedVideos += 1;
      continue;
    }

    if (item.type === 'photo' && counts.photos >= MAX_PLACE_PHOTOS) {
      issues.rejectedPhotos += 1;
      continue;
    }

    if (counts.total >= MAX_PLACE_MEDIA_ITEMS) {
      issues.rejectedTotal += 1;
      continue;
    }

    nextMedia.push(item);
  }

  return { issues, nextMedia };
}

export function replacePlaceMediaWithinLimits(
  currentMedia: PlaceMedia[],
  index: number,
  replacement: PlaceMedia,
) {
  if (index < 0 || index >= currentMedia.length) {
    return {
      issues: { rejectedPhotos: 0, rejectedTotal: 0, rejectedVideos: 0 },
      nextMedia: currentMedia,
      replaced: false,
    };
  }

  const nextWithoutItem = currentMedia.filter((_, itemIndex) => itemIndex !== index);
  const { issues, nextMedia: appendedMedia } = appendPlaceMediaWithinLimits(nextWithoutItem, [
    replacement,
  ]);
  const acceptedReplacement = appendedMedia[appendedMedia.length - 1];

  if (!acceptedReplacement || appendedMedia.length === nextWithoutItem.length) {
    return { issues, nextMedia: currentMedia, replaced: false };
  }

  const reorderedMedia = [...nextWithoutItem];
  reorderedMedia.splice(Math.min(index, reorderedMedia.length), 0, acceptedReplacement);

  return { issues, nextMedia: reorderedMedia, replaced: true };
}

export function usePlaceEditorMediaController({
  media,
  setMedia,
  showSelectionFeedback,
}: UsePlaceEditorMediaControllerParams) {
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [editingVideoThumbnailIndex, setEditingVideoThumbnailIndex] = useState<number | null>(null);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const isAddingMediaRef = useRef(false);

  const handleAddMedia = useCallback(async () => {
    if (isAddingMediaRef.current) {
      return;
    }

    const currentCounts = getPlaceMediaCounts(media);
    const remainingSlots = Math.max(MAX_PLACE_MEDIA_ITEMS - currentCounts.total, 0);

    if (remainingSlots === 0) {
      showToast(tr.placeEditor.mediaLimitNotice(MAX_PLACE_MEDIA_ITEMS), 'error');
      return;
    }

    isAddingMediaRef.current = true;
    setIsAddingMedia(true);

    try {
      await waitForMediaPickerTransition();
      const selection = await pickPlaceMediaFromPrompt({
        allowMultiple: true,
        maxSelection: remainingSlots,
        remainingPhotos: Math.max(MAX_PLACE_PHOTOS - currentCounts.photos, 0),
        remainingVideos: Math.max(MAX_PLACE_VIDEOS - currentCounts.videos, 0),
      });

      if (selection.items.length > 0) {
        const { issues, nextMedia } = appendPlaceMediaWithinLimits(media, selection.items);
        const nextVideoIndex = nextMedia.findIndex(
          (item, index) => index >= media.length && item.type === 'video',
        );

        setMedia(nextMedia);
        setSelectedMediaIndex(null);
        setEditingVideoThumbnailIndex(nextVideoIndex >= 0 ? nextVideoIndex : null);
        showSelectionFeedback(
          issues,
          selection.rejectedVideoCount,
          selection.rejectedOversizeCount,
        );
      } else if (selection.rejectedVideoCount > 0 || selection.rejectedOversizeCount > 0) {
        showSelectionFeedback(
          { rejectedPhotos: 0, rejectedTotal: 0, rejectedVideos: 0 },
          selection.rejectedVideoCount,
          selection.rejectedOversizeCount,
        );
      }
    } finally {
      await waitForMediaPickerTransition();
      isAddingMediaRef.current = false;
      setIsAddingMedia(false);
    }
  }, [media, setMedia, showSelectionFeedback]);

  const handleRemoveMedia = useCallback(
    (index: number) => {
      setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index));
      setSelectedMediaIndex((current) => adjustIndexAfterRemoval(current, index));
      setEditingVideoThumbnailIndex((current) => adjustIndexAfterRemoval(current, index));
    },
    [setMedia],
  );

  const handleMediaPress = useCallback(
    (index: number) => {
      setSelectedMediaIndex((current) => {
        if (current == null) {
          return index;
        }

        if (current === index) {
          return null;
        }

        setMedia((items) => swapPhotos(items, current, index));
        return null;
      });
    },
    [setMedia],
  );

  const handleEditMedia = useCallback(
    async (index: number) => {
      if (isAddingMedia || index < 0 || index >= media.length) {
        return;
      }

      setIsAddingMedia(true);

      try {
        await waitForMediaPickerTransition();
        const mediaWithoutEditedItem = media.filter((_, itemIndex) => itemIndex !== index);
        const remainingCounts = getPlaceMediaCounts(mediaWithoutEditedItem);
        const selection = await pickPlaceMediaFromPrompt({
          allowMultiple: false,
          maxSelection: 1,
          remainingPhotos: Math.max(MAX_PLACE_PHOTOS - remainingCounts.photos, 0),
          remainingVideos: Math.max(MAX_PLACE_VIDEOS - remainingCounts.videos, 0),
        });
        const replacement = selection.items[0];

        if (!replacement) {
          if (selection.rejectedVideoCount > 0 || selection.rejectedOversizeCount > 0) {
            showSelectionFeedback(
              { rejectedPhotos: 0, rejectedTotal: 0, rejectedVideos: 0 },
              selection.rejectedVideoCount,
              selection.rejectedOversizeCount,
            );
          }
          return;
        }

        const { issues, nextMedia } = replacePlaceMediaWithinLimits(media, index, replacement);
        setMedia(nextMedia);
        setSelectedMediaIndex(null);
        setEditingVideoThumbnailIndex(replacement.type === 'video' ? index : null);
        showSelectionFeedback(
          issues,
          selection.rejectedVideoCount,
          selection.rejectedOversizeCount,
        );
      } finally {
        await waitForMediaPickerTransition();
        setIsAddingMedia(false);
      }
    },
    [isAddingMedia, media, setMedia, showSelectionFeedback],
  );

  const openVideoThumbnailEditor = useCallback(
    (index: number) => {
      if (index >= 0 && index < media.length && media[index]?.type === 'video') {
        setEditingVideoThumbnailIndex(index);
      }
    },
    [media],
  );

  const applyVideoThumbnail = useCallback(
    (selection: { thumbnailTimeMs: number; thumbnailUrl?: string }) => {
      setMedia((current) =>
        current.map((item, index) =>
          index === editingVideoThumbnailIndex
            ? {
                ...item,
                thumbnailTimeMs: selection.thumbnailTimeMs,
                thumbnailUrl: selection.thumbnailUrl || undefined,
              }
            : item,
        ),
      );
      setEditingVideoThumbnailIndex(null);
    },
    [editingVideoThumbnailIndex, setMedia],
  );

  const resetMediaInteraction = useCallback(() => {
    setSelectedMediaIndex(null);
    setEditingVideoThumbnailIndex(null);
  }, []);

  return {
    applyVideoThumbnail,
    closeVideoThumbnailEditor: () => setEditingVideoThumbnailIndex(null),
    editingVideoThumbnailIndex,
    handleAddMedia,
    handleEditMedia,
    handleMediaPress,
    handleRemoveMedia,
    isAddingMedia,
    openVideoThumbnailEditor,
    resetMediaInteraction,
    selectedMediaIndex,
  };
}

function adjustIndexAfterRemoval(current: number | null, removedIndex: number) {
  if (current == null || current === removedIndex) {
    return null;
  }

  return current > removedIndex ? current - 1 : current;
}
