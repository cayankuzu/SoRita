import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  countPendingListAdditions,
  EMPTY_NEW_LIST_FORM,
  getErrorMessage,
  type PlaceEditorFields,
} from '@/mobile/app/features/map/application/placeEditorStateUtils';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  clampMultilineTextLength,
  clampTextLength,
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  MAX_SELECTED_LISTS_PER_PLACE_SAVE,
  trimPreservingLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';
import { createUuid } from '@/shared/utils/id';

type UsePlaceEditorListSelectionParams = {
  currentMembershipListIds: Set<string>;
  fields: Pick<
    PlaceEditorFields,
    'newListCoverImage' | 'newListDescription' | 'newListName' | 'newListPublic'
  >;
  onCreateList?: (list: PlaceList) => Promise<void> | void;
  setFields: Dispatch<SetStateAction<PlaceEditorFields>>;
  showListSelectionNotice: (message: string) => void;
  visible: boolean;
};

// Which lists the place goes into: picking existing ones, at most
// MAX_SELECTED_LISTS_PER_PLACE_SAVE new ones per save, and making a list on
// the spot, which is then picked too.
export function usePlaceEditorListSelection({
  currentMembershipListIds,
  fields,
  onCreateList,
  setFields,
  showListSelectionNotice,
  visible,
}: UsePlaceEditorListSelectionParams) {
  const [isCreatingList, setIsCreatingList] = useState(false);
  const hasShownMultiListGuidanceRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      hasShownMultiListGuidanceRef.current = false;
    }
  }, [visible]);

  const toggleList = useCallback(
    (listId: string, options?: { blocked?: boolean; listName?: string }) => {
      if (options?.blocked) {
        showListSelectionNotice(
          tr.placeEditor.duplicateListSelectionBlocked(
            options.listName || tr.placeEditor.duplicateListBadge,
          ),
        );
        return;
      }

      let blockedBySelectionLimit = false;
      let shouldShowMultiListGuidance = false;

      setFields((current) => {
        const selected = current.selectedLists;

        if (selected.includes(listId)) {
          return { ...current, selectedLists: selected.filter((item) => item !== listId) };
        }

        if (
          !currentMembershipListIds.has(listId) &&
          countPendingListAdditions(selected, currentMembershipListIds) >=
            MAX_SELECTED_LISTS_PER_PLACE_SAVE
        ) {
          blockedBySelectionLimit = true;
          return current;
        }

        if (selected.length >= 1 && !hasShownMultiListGuidanceRef.current) {
          shouldShowMultiListGuidance = true;
        }

        return { ...current, selectedLists: [...selected, listId] };
      });

      if (blockedBySelectionLimit) {
        showListSelectionNotice(
          tr.placeEditor.notices.selectionLimit(MAX_SELECTED_LISTS_PER_PLACE_SAVE),
        );
        return;
      }

      if (shouldShowMultiListGuidance) {
        hasShownMultiListGuidanceRef.current = true;
        showListSelectionNotice(tr.placeEditor.notices.multiListHint);
      }
    },
    [currentMembershipListIds, setFields, showListSelectionNotice],
  );

  const { newListCoverImage, newListDescription, newListName, newListPublic } = fields;

  const handleCreateList = useCallback(async () => {
    const name = clampTextLength(newListName, LIST_NAME_MAX_LENGTH).trim();

    if (isCreatingList || !onCreateList || !name) {
      return;
    }

    const description = trimPreservingLineBreaks(
      clampMultilineTextLength(newListDescription, LIST_DESCRIPTION_MAX_LENGTH),
    );
    const now = new Date().toISOString();
    const list: PlaceList = {
      id: createUuid(),
      userId: '',
      name,
      description: description || undefined,
      emoji: tr.placeEditor.defaultEmoji,
      coverImage: newListCoverImage || undefined,
      places: [],
      isPublic: newListPublic,
      likes: 0,
      likedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      setIsCreatingList(true);
      await onCreateList(list);
      let blockedBySelectionLimit = false;

      setFields((current) => {
        blockedBySelectionLimit =
          countPendingListAdditions(current.selectedLists, currentMembershipListIds) >=
          MAX_SELECTED_LISTS_PER_PLACE_SAVE;

        return {
          ...current,
          ...EMPTY_NEW_LIST_FORM,
          selectedLists: blockedBySelectionLimit
            ? current.selectedLists
            : [...current.selectedLists, list.id],
        };
      });
      showToast(tr.placeEditor.newListCreated, 'success');

      if (blockedBySelectionLimit) {
        showListSelectionNotice(
          tr.placeEditor.notices.listCreatedButNotSelected(MAX_SELECTED_LISTS_PER_PLACE_SAVE),
        );
      }
    } catch (error) {
      logger.error('place-editor', 'Failed to create list', error);
      showToast(getErrorMessage(error, tr.placeEditor.listCreateFailed), 'error');
    } finally {
      setIsCreatingList(false);
    }
  }, [
    currentMembershipListIds,
    isCreatingList,
    newListCoverImage,
    newListDescription,
    newListName,
    newListPublic,
    onCreateList,
    setFields,
    showListSelectionNotice,
  ]);

  return { handleCreateList, isCreatingList, toggleList };
}
