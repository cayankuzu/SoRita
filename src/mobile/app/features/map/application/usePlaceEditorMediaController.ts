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
import { PLACE_MEDIA_MAX_FILE_SIZE_MB } from '@/mobile/app/platform/media/placeMediaSize';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getPlaceMediaCounts } from '@/mobile/app/shared/utils/placeMedia';
import {
  reorderPhotos,
  swapPhotos,
} from '@/mobile/app/features/map/application/placeEditorStateUtils';

export type MediaSelectionIssueSummary = {
  rejectedPhotos: number;
  rejectedTotal: number;
  rejectedVideos: number;
};

export type EditorBlockingNotice = {
  description: string;
  title: string;
};

// Shown when a picked or saved file is over the upload budget; it stops the
// step, so it is a notice rather than a passing toast.
export const OVERSIZED_MEDIA_NOTICE: EditorBlockingNotice = {
  description: tr.placeEditor.mediaSizeLimitPopupDescription(PLACE_MEDIA_MAX_FILE_SIZE_MB),
  title: tr.placeEditor.mediaSizeLimitPopupTitle,
};

type UsePlaceEditorMediaControllerParams = {
  media: PlaceMedia[];
  setMedia: Dispatch<SetStateAction<PlaceMedia[]>>;
  showBlockingNotice: (notice: EditorBlockingNotice) => void;
};

// One message for a picker result, the most serious first.
function reportMediaSelectionIssues(
  issues: MediaSelectionIssueSummary,
  rejectedVideoDurationCount: number,
  rejectedOversizeCount: number,
  showBlockingNotice: (notice: EditorBlockingNotice) => void,
) {
  if (rejectedOversizeCount > 0) {
    showBlockingNotice(OVERSIZED_MEDIA_NOTICE);
  } else if (rejectedVideoDurationCount > 0) {
    showToast(tr.placeEditor.videoDurationLimitExceeded, 'error');
  } else if (issues.rejectedVideos > 0) {
    showToast(tr.placeEditor.videoLimitNotice(MAX_PLACE_VIDEOS), 'error');
  } else if (issues.rejectedPhotos > 0) {
    showToast(tr.placeEditor.photoLimitNotice(MAX_PLACE_PHOTOS), 'error');
  } else if (issues.rejectedTotal > 0) {
    showToast(tr.placeEditor.mediaLimitNotice(MAX_PLACE_MEDIA_ITEMS), 'error');
  }
}

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

export function usePlaceEditorMediaController({
  media,
  setMedia,
  showBlockingNotice,
}: UsePlaceEditorMediaControllerParams) {
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
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

      const { issues, nextMedia } = appendPlaceMediaWithinLimits(media, selection.items);

      if (selection.items.length > 0) {
        setMedia(nextMedia);
        setSelectedMediaIndex(null);
      }

      reportMediaSelectionIssues(
        issues,
        selection.rejectedVideoCount,
        selection.rejectedOversizeCount,
        showBlockingNotice,
      );
    } finally {
      await waitForMediaPickerTransition();
      isAddingMediaRef.current = false;
      setIsAddingMedia(false);
    }
  }, [media, setMedia, showBlockingNotice]);

  const handleRemoveMedia = useCallback(
    (index: number) => {
      setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index));
      setSelectedMediaIndex((current) => adjustIndexAfterRemoval(current, index));
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

  const handleMoveMedia = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= media.length ||
        toIndex >= media.length
      ) {
        return;
      }

      setMedia((items) => reorderPhotos(items, fromIndex, toIndex));
      setSelectedMediaIndex(null);
    },
    [media.length, setMedia],
  );

  const resetMediaInteraction = useCallback(() => {
    setSelectedMediaIndex(null);
  }, []);

  return {
    handleAddMedia,
    handleMediaPress,
    handleMoveMedia,
    handleRemoveMedia,
    isAddingMedia,
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
