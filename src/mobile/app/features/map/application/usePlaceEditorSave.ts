import { useCallback, useEffect, useRef, useState } from 'react';

import type { Place } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import { buildPlaceSavePayload } from '@/mobile/app/features/map/application/placeEditorPreview';
import type {
  PlaceEditorSaveOptions,
  PlaceEditorSaveStartHandler,
} from '@/mobile/app/features/map/application/placeEditorSaveTypes';
import type { PlaceEditorFields } from '@/mobile/app/features/map/application/placeEditorStateUtils';
import {
  OVERSIZED_MEDIA_NOTICE,
  type EditorBlockingNotice,
} from '@/mobile/app/features/map/application/usePlaceEditorMediaController';
import { useAppProgressBanner } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { findFirstOversizedPlaceMedia } from '@/mobile/app/platform/media/placeMediaSize';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { isAbortError } from '@/mobile/app/shared/utils/abort';
import { normalizeSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';
import {
  clampTextLength,
  MAX_SELECTED_LISTS_PER_PLACE_SAVE,
  PLACE_MENU_URL_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type UsePlaceEditorSaveParams = {
  buildDraft: () => PlaceEditorDraft;
  canContinue: boolean;
  existingPlace?: Place | null;
  fields: PlaceEditorFields;
  isCreatingList: boolean;
  lat: number;
  lng: number;
  onSave: (
    place: Omit<Place, 'id' | 'addedAt'>,
    targetListIds: string[],
    options?: PlaceEditorSaveOptions,
  ) => Promise<void> | void;
  onSaveError?: (draft: PlaceEditorDraft) => void;
  onSaveStart?: PlaceEditorSaveStartHandler;
  pendingAddedListCount: number;
  placeAddress?: string;
  placeName?: string;
  showBlockingNotice: (notice: EditorBlockingNotice) => void;
  showListSelectionNotice: (message: string) => void;
  showValidationFeedback: () => void;
  targetListIds: string[];
};

// Saving runs behind the app's progress banner, so the editor can close while
// uploads continue; a failure hands the draft back so nothing typed is lost.
export function usePlaceEditorSave({
  buildDraft,
  canContinue,
  existingPlace,
  fields,
  isCreatingList,
  lat,
  lng,
  onSave,
  onSaveError,
  onSaveStart,
  pendingAddedListCount,
  placeAddress,
  placeName,
  showBlockingNotice,
  showListSelectionNotice,
  showValidationFeedback,
  targetListIds,
}: UsePlaceEditorSaveParams) {
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);
  const { beginProgress } = useAppProgressBanner();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving || isCreatingList || !canContinue) {
      showValidationFeedback();
      return;
    }

    if (pendingAddedListCount > MAX_SELECTED_LISTS_PER_PLACE_SAVE) {
      showListSelectionNotice(
        tr.placeEditor.notices.selectionLimit(MAX_SELECTED_LISTS_PER_PLACE_SAVE),
      );
      return;
    }

    if (targetListIds.length === 0) {
      showValidationFeedback();
      return;
    }

    if (await findFirstOversizedPlaceMedia(fields.media)) {
      showBlockingNotice(OVERSIZED_MEDIA_NOTICE);
      return;
    }

    const normalizedMenuUrl = clampTextLength(fields.menuUrl, PLACE_MENU_URL_MAX_LENGTH).trim();
    const safeMenuUrl = normalizedMenuUrl ? normalizeSafeExternalUrl(normalizedMenuUrl) : null;

    if (normalizedMenuUrl && !safeMenuUrl) {
      showToast(tr.placeEditor.menuUrlInvalid, 'error');
      return;
    }

    const draftSnapshot = buildDraft();
    const saveSessionConfig = onSaveStart?.(draftSnapshot);
    const progressSession = beginProgress({
      detail: tr.placeEditor.saveProgressLists(targetListIds.length),
      onCancel: saveSessionConfig?.onBannerCancel,
      onOpen: saveSessionConfig?.onBannerOpen,
    });

    try {
      if (isMountedRef.current) {
        setIsSaving(true);
      }

      await onSave(
        buildPlaceSavePayload({
          ...fields,
          existingPlace,
          menuUrl: safeMenuUrl || undefined,
          lat,
          lng,
          placeAddress,
          placeName,
        }),
        targetListIds,
        {
          abortSignal: saveSessionConfig?.abortSignal,
          onProgress: progressSession.setProgress,
        },
      );
      progressSession.complete();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      onSaveError?.(draftSnapshot);
      progressSession.fail({
        onCancel: saveSessionConfig?.onBannerCancel,
        onOpen: saveSessionConfig?.onBannerOpen,
        onRetry: saveSessionConfig?.onBannerRetry,
      });
      const fallbackMessage = existingPlace
        ? tr.placeEditor.placeUpdateFailed
        : tr.placeEditor.placeSaveFailed;
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : fallbackMessage;

      showToast(message || fallbackMessage, 'error');
    } finally {
      progressSession.end();
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [
    beginProgress,
    buildDraft,
    canContinue,
    existingPlace,
    fields,
    isCreatingList,
    isSaving,
    lat,
    lng,
    onSave,
    onSaveError,
    onSaveStart,
    pendingAddedListCount,
    placeAddress,
    placeName,
    showBlockingNotice,
    showListSelectionNotice,
    showValidationFeedback,
    targetListIds,
  ]);

  return { handleSave, isSaving };
}
