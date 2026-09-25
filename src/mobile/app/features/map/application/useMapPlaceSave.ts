import { useCallback, useRef } from 'react';

import { useAppProgressBanner } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import type { PlaceEditorDraft } from '@/mobile/app/contracts/placeEditorDraft';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { useUpdateListsMutation } from '@/mobile/app/data/hooks/useListMutations';
import { buildChangedListsForPlaceSave } from '@/mobile/app/features/map/application/mapScreenUtils';
import type {
  PlaceEditorSaveOptions,
  PlaceEditorSaveSessionConfig,
} from '@/mobile/app/features/map/application/placeEditorSaveTypes';
import type { MapEditorSession } from '@/mobile/app/features/map/application/useMapEditorSession';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { isAbortError } from '@/mobile/app/shared/utils/abort';

type PendingPlaceSaveRequest = {
  placeData: Omit<Place, 'id' | 'addedAt'>;
  sourcePlace: Place | null;
  targetListIds: string[];
};

type UseMapPlaceSaveParams = {
  editor: Pick<
    MapEditorSession,
    'editorData' | 'minimizeEditor' | 'reopenMinimizedEditor' | 'setIsEditorInteractionLocked'
  >;
  lists: PlaceList[];
  onSaved: () => void;
  user: { id: string; name: string } | null;
};

// Saving a place from the map: the editor minimizes and locks while the lists
// are written behind the progress banner, which can cancel, reopen the editor
// or, after a failure, retry the same request.
export function useMapPlaceSave({ editor, lists, onSaved, user }: UseMapPlaceSaveParams) {
  const { beginProgress } = useAppProgressBanner();
  const updateListsMutation = useUpdateListsMutation();
  const activeSaveAbortControllerRef = useRef<AbortController | null>(null);
  const activeSaveSourcePlaceRef = useRef<Place | null>(null);
  const pendingPlaceSaveRequestRef = useRef<PendingPlaceSaveRequest | null>(null);
  const { editorData, minimizeEditor, reopenMinimizedEditor, setIsEditorInteractionLocked } =
    editor;

  const openPendingSaveTarget = useCallback(() => {
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate('MainTabs', { screen: 'Map' });
    }

    reopenMinimizedEditor();
  }, [reopenMinimizedEditor]);

  const cancelActiveSave = useCallback(() => {
    activeSaveAbortControllerRef.current?.abort();
    activeSaveAbortControllerRef.current = null;
    pendingPlaceSaveRequestRef.current = null;
    setIsEditorInteractionLocked(false);
  }, [setIsEditorInteractionLocked]);

  const performPlaceSave = useCallback(
    async (request: PendingPlaceSaveRequest, options?: PlaceEditorSaveOptions) => {
      if (!user) {
        return;
      }

      const changedLists = buildChangedListsForPlaceSave({
        lists,
        selectedListIds: Array.from(new Set(request.targetListIds)),
        sourcePlace: request.sourcePlace,
        placeData: request.placeData,
        user,
      });

      pendingPlaceSaveRequestRef.current = request;

      try {
        await updateListsMutation.mutateAsync({
          abortSignal: options?.abortSignal,
          lists: changedLists,
          onProgress: options?.onProgress,
          previousLists: lists,
        });
        onSaved();
        activeSaveAbortControllerRef.current = null;
        activeSaveSourcePlaceRef.current = null;
        pendingPlaceSaveRequestRef.current = null;
        showToast(tr.map.placeSaved, 'success');
      } catch (error) {
        setIsEditorInteractionLocked(false);
        activeSaveAbortControllerRef.current = null;
        throw error;
      }
    },
    [lists, onSaved, setIsEditorInteractionLocked, updateListsMutation, user],
  );

  const retryPendingSave = useCallback(() => {
    const pendingRequest = pendingPlaceSaveRequestRef.current;

    if (!pendingRequest) {
      return;
    }

    const abortController = new AbortController();
    activeSaveAbortControllerRef.current = abortController;
    setIsEditorInteractionLocked(true);

    const progressSession = beginProgress({
      detail: tr.placeEditor.saveProgressLists(new Set(pendingRequest.targetListIds).size),
      onCancel: cancelActiveSave,
      onOpen: openPendingSaveTarget,
    });

    void performPlaceSave(pendingRequest, {
      abortSignal: abortController.signal,
      onProgress: progressSession.setProgress,
    })
      .then(() => {
        progressSession.complete();
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        progressSession.fail({
          onCancel: cancelActiveSave,
          onOpen: openPendingSaveTarget,
          onRetry: retryPendingSave,
        });
        showToast(getUserFacingErrorMessage(error, tr.map.savePlaceUnexpected), 'error');
      })
      .finally(() => {
        progressSession.end();
      });
  }, [
    beginProgress,
    cancelActiveSave,
    openPendingSaveTarget,
    performPlaceSave,
    setIsEditorInteractionLocked,
  ]);

  const beginEditorSave = useCallback(
    (draft: PlaceEditorDraft): PlaceEditorSaveSessionConfig => {
      const bannerActions = {
        onBannerCancel: cancelActiveSave,
        onBannerOpen: openPendingSaveTarget,
        onBannerRetry: retryPendingSave,
      };

      if (!editorData) {
        return bannerActions;
      }

      const abortController = new AbortController();
      activeSaveAbortControllerRef.current = abortController;
      activeSaveSourcePlaceRef.current = editorData.existingPlace || null;
      pendingPlaceSaveRequestRef.current = null;
      minimizeEditor(draft, { lockForSave: true });

      return { abortSignal: abortController.signal, ...bannerActions };
    },
    [cancelActiveSave, editorData, minimizeEditor, openPendingSaveTarget, retryPendingSave],
  );

  const handleSavePlace = useCallback(
    async (
      placeData: Omit<Place, 'id' | 'addedAt'>,
      targetListIds: string[],
      options?: PlaceEditorSaveOptions,
    ) => {
      await performPlaceSave(
        { placeData, sourcePlace: activeSaveSourcePlaceRef.current, targetListIds },
        options,
      );
    },
    [performPlaceSave],
  );

  return { beginEditorSave, handleSavePlace };
}
