import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  PLACE_DIETARY_OPTIONS,
  PLACE_FEATURE_OPTIONS,
} from '@/mobile/app/catalog/placeOptions';
import { useCoverImagePicker } from '@/mobile/app/platform/media/useCoverImagePicker';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/contracts/placeEditorDraft';
import type {
  PlaceEditorSaveOptions,
  PlaceEditorSaveStartHandler,
} from '@/mobile/app/features/map/application/placeEditorSaveTypes';
import { buildPlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorPreview';
import {
  buildEditorSourceKey,
  createInitialPlaceEditorFields,
  fieldSetter,
  hasValidPlaceIdentity,
  isValidPriceRange,
  LAST_PLACE_EDITOR_STEP_INDEX,
  sanitizeNumericInput,
  sortSelectedCategories,
  toggleArrayValue,
  type PlaceEditorFields,
} from '@/mobile/app/features/map/application/placeEditorStateUtils';
import { usePlaceEditorListIdentity } from '@/mobile/app/features/map/application/usePlaceEditorListIdentity';
import { usePlaceEditorListSelection } from '@/mobile/app/features/map/application/usePlaceEditorListSelection';
import {
  usePlaceEditorMediaController,
  type EditorBlockingNotice,
} from '@/mobile/app/features/map/application/usePlaceEditorMediaController';
import { usePlaceEditorSave } from '@/mobile/app/features/map/application/usePlaceEditorSave';
import { useAutoDismissingNotice } from '@/mobile/app/shared/hooks/useAutoDismissingNotice';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  clampMultilineTextLength,
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_MENU_URL_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  clampTextLength,
} from '@/mobile/app/shared/validation/contentLimits';

// A blocking notice interrupts a step, so it leaves sooner than the list-
// selection hint, which the reader may still be acting on.
const BLOCKING_NOTICE_DURATION_MS = 2_800;
const LIST_SELECTION_NOTICE_DURATION_MS = 3_400;

type UsePlaceEditorStateParams = {
  visible: boolean;
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
  lists: PlaceList[];
  existingPlace?: Place | null;
  draft?: PlaceEditorDraft | null;
  onSave: (
    place: Omit<Place, 'id' | 'addedAt'>,
    targetListIds: string[],
    options?: PlaceEditorSaveOptions,
  ) => Promise<void> | void;
  onSaveError?: (draft: PlaceEditorDraft) => void;
  onSaveStart?: PlaceEditorSaveStartHandler;
  onCreateList?: (list: PlaceList) => Promise<void> | void;
};

// Setters the steps call as the reader types; each one keeps the field
// within its limit.
function createFieldSetters(setFields: React.Dispatch<React.SetStateAction<PlaceEditorFields>>) {
  return {
    setAddress: fieldSetter(setFields, 'address', (value) =>
      clampTextLength(value, PLACE_ADDRESS_MAX_LENGTH),
    ),
    setMenuUrl: fieldSetter(setFields, 'menuUrl', (value) =>
      clampTextLength(value, PLACE_MENU_URL_MAX_LENGTH),
    ),
    setName: fieldSetter(setFields, 'name', (value) => clampTextLength(value, PLACE_NAME_MAX_LENGTH)),
    setNewListCoverImage: fieldSetter(setFields, 'newListCoverImage'),
    setNewListDescription: fieldSetter(setFields, 'newListDescription', (value) =>
      clampMultilineTextLength(value, LIST_DESCRIPTION_MAX_LENGTH),
    ),
    setNewListName: fieldSetter(setFields, 'newListName', (value) =>
      clampTextLength(value, LIST_NAME_MAX_LENGTH),
    ),
    setNewListPublic: fieldSetter(setFields, 'newListPublic'),
    setNotes: fieldSetter(setFields, 'notes', (value) =>
      clampMultilineTextLength(value, PLACE_NOTES_MAX_LENGTH),
    ),
    setPriceMax: fieldSetter(setFields, 'priceMax', sanitizeNumericInput),
    setPriceMin: fieldSetter(setFields, 'priceMin', sanitizeNumericInput),
    setRating: fieldSetter(setFields, 'rating'),
    setShowNewListForm: fieldSetter(setFields, 'showNewListForm'),
    setStudentFriendly: fieldSetter(setFields, 'studentFriendly'),
    setTitle: fieldSetter(setFields, 'title', (value) =>
      clampMultilineTextLength(value, PLACE_TITLE_MAX_LENGTH),
    ),
  };
}

export function usePlaceEditorState({
  visible,
  lat,
  lng,
  placeName,
  placeAddress,
  lists,
  existingPlace,
  draft,
  onSave,
  onSaveError,
  onSaveStart,
  onCreateList,
}: UsePlaceEditorStateParams) {
  const [fields, setFields] = useState<PlaceEditorFields>(() =>
    createInitialPlaceEditorFields({ draft, existingPlace, lists, placeAddress, placeName }),
  );
  const setters = useMemo(() => createFieldSetters(setFields), []);
  const internalSetters = useMemo(
    () => ({
      setAtmosphere: fieldSetter(setFields, 'atmosphere'),
      setBestTimes: fieldSetter(setFields, 'bestTimes'),
      setFeatures: fieldSetter(setFields, 'features'),
      setMedia: fieldSetter(setFields, 'media'),
      setSelectedCategories: fieldSetter(setFields, 'selectedCategories'),
      setStep: fieldSetter(setFields, 'step'),
    }),
    [],
  );

  const wasVisibleRef = useRef(false);
  const initSourceKeyRef = useRef<string | null>(null);
  const lastIncomingNameRef = useRef(placeName || existingPlace?.name || '');
  const lastIncomingAddressRef = useRef(placeAddress || existingPlace?.address || '');
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const {
    notice: blockingNotice,
    show: showBlockingNotice,
    clear: clearBlockingNotice,
  } = useAutoDismissingNotice<EditorBlockingNotice>(BLOCKING_NOTICE_DURATION_MS);
  const {
    notice: listSelectionNotice,
    show: showListSelectionNotice,
    clear: clearListSelectionNotice,
  } = useAutoDismissingNotice<string>(LIST_SELECTION_NOTICE_DURATION_MS);

  // Opening the editor starts it from the draft or the place; while it stays
  // open on the same point, a name or address that arrives late fills in only
  // what the reader has not typed over.
  useEffect(() => {
    const incomingName = placeName || existingPlace?.name || '';
    const incomingAddress = placeAddress || existingPlace?.address || '';

    if (!visible) {
      wasVisibleRef.current = false;
      initSourceKeyRef.current = null;
      lastIncomingNameRef.current = incomingName;
      lastIncomingAddressRef.current = incomingAddress;
      clearBlockingNotice();
      clearListSelectionNotice();
      return;
    }

    const sourceKey = draft
      ? `draft:${draft.step}:${draft.name}:${draft.address}`
      : buildEditorSourceKey({ existingPlace, lat, lng, placeName, placeAddress });

    if (!draft && wasVisibleRef.current && initSourceKeyRef.current === sourceKey) {
      const previousName = lastIncomingNameRef.current;
      const previousAddress = lastIncomingAddressRef.current;
      const keepsTyped = (value: string, previous: string) =>
        Boolean(value.trim()) && value !== previous;

      if (incomingName !== previousName || incomingAddress !== previousAddress) {
        setFields((current) => ({
          ...current,
          name:
            incomingName !== previousName && !keepsTyped(current.name, previousName)
              ? incomingName
              : current.name,
          address:
            incomingAddress !== previousAddress && !keepsTyped(current.address, previousAddress)
              ? incomingAddress
              : current.address,
        }));
      }

      lastIncomingNameRef.current = incomingName;
      lastIncomingAddressRef.current = incomingAddress;
      return;
    }

    wasVisibleRef.current = true;
    initSourceKeyRef.current = sourceKey;
    lastIncomingNameRef.current = draft ? draft.name : incomingName;
    lastIncomingAddressRef.current = draft ? draft.address : incomingAddress;
    setFields(
      createInitialPlaceEditorFields({
        draft,
        existingPlace,
        lists: listsRef.current,
        placeAddress,
        placeName,
      }),
    );
  }, [clearBlockingNotice, clearListSelectionNotice, draft, existingPlace, lat, lng, placeAddress, placeName, visible]);

  const { features, media, name, priceMax, priceMin, step } = fields;
  const dietarySelections = useMemo(
    () => features.filter((item) => PLACE_DIETARY_OPTIONS.includes(item)),
    [features],
  );
  const generalFeatureOptions = useMemo(
    () => PLACE_FEATURE_OPTIONS.filter((item) => !PLACE_DIETARY_OPTIONS.includes(item)),
    [],
  );

  const {
    currentMembershipListIds,
    duplicateListIds,
    hasTargetListSelection,
    pendingAddedListCount,
    safeSelectedLists,
  } = usePlaceEditorListIdentity({
    currentName: name,
    draftName: draft?.name,
    existingPlace,
    lat,
    lists,
    lng,
    placeName,
    selectedLists: fields.selectedLists,
  });
  const priceRangeIsValid = isValidPriceRange(priceMin, priceMax);
  const hasPlaceIdentity = hasValidPlaceIdentity([name, placeName, fields.address, placeAddress]);
  const hasListsToChoose = lists.length > 0;
  const pendingNewListName = fields.showNewListForm ? fields.newListName.trim() : '';

  const showValidationFeedback = useCallback(() => {
    if (!hasPlaceIdentity) {
      showToast(tr.placeEditor.placeIdentityRequired, 'error');
    } else if (!priceRangeIsValid) {
      showToast(tr.placeEditor.priceRangeInvalid, 'error');
    } else if (!hasTargetListSelection) {
      showListSelectionNotice(
        hasListsToChoose
          ? tr.placeEditor.notices.listSelectionRequired
          : pendingNewListName
            ? tr.placeEditor.notices.createListFirst
            : tr.placeEditor.notices.createOrSelectList,
      );
    }
  }, [
    hasListsToChoose,
    hasPlaceIdentity,
    hasTargetListSelection,
    pendingNewListName,
    priceRangeIsValid,
    showListSelectionNotice,
  ]);

  const {
    handleAddMedia,
    handleMediaPress,
    handleMoveMedia,
    handleRemoveMedia,
    isAddingMedia,
    resetMediaInteraction,
    selectedMediaIndex,
  } = usePlaceEditorMediaController({
    media,
    setMedia: internalSetters.setMedia,
    showBlockingNotice,
  });

  useEffect(() => {
    resetMediaInteraction();
  }, [draft, existingPlace, lat, lng, placeAddress, placeName, resetMediaInteraction, visible]);

  const canContinue =
    hasPlaceIdentity &&
    (step === 0 ||
      (step === LAST_PLACE_EDITOR_STEP_INDEX
        ? hasTargetListSelection && priceRangeIsValid
        : priceRangeIsValid));

  const { handleCreateList, isCreatingList, toggleList } = usePlaceEditorListSelection({
    currentMembershipListIds,
    fields,
    onCreateList,
    setFields,
    showListSelectionNotice,
    visible,
  });

  const toggleCategory = useCallback(
    (value: string) => {
      internalSetters.setSelectedCategories((previous) =>
        previous.includes(value)
          ? previous.filter((item) => item !== value)
          : sortSelectedCategories([...previous, value]),
      );
    },
    [internalSetters],
  );
  const toggleBestTime = useCallback(
    (value: string) => toggleArrayValue(value, internalSetters.setBestTimes),
    [internalSetters],
  );
  const toggleAtmosphere = useCallback(
    (value: string) => toggleArrayValue(value, internalSetters.setAtmosphere),
    [internalSetters],
  );
  const toggleFeature = useCallback(
    (value: string) => toggleArrayValue(value, internalSetters.setFeatures),
    [internalSetters],
  );

  const buildDraft = useCallback((): PlaceEditorDraft => buildPlaceEditorDraft(fields), [fields]);

  const { isPicking: isPickingListCover, pickCover: handlePickListCover } = useCoverImagePicker(
    setters.setNewListCoverImage,
  );

  const { handleSave, isSaving } = usePlaceEditorSave({
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
    targetListIds: safeSelectedLists,
  });

  const goToPreviousStep = useCallback(() => {
    internalSetters.setStep((value) => Math.max(0, value - 1));
  }, [internalSetters]);

  const goToNextStep = useCallback(() => {
    if (!canContinue) {
      showValidationFeedback();
      return;
    }

    internalSetters.setStep((value) => Math.min(value + 1, LAST_PLACE_EDITOR_STEP_INDEX));
  }, [canContinue, internalSetters, showValidationFeedback]);

  return {
    ...fields,
    ...setters,
    blockingNotice,
    buildDraft,
    canContinue,
    clearBlockingNotice,
    currentMembershipListIds,
    dietarySelections,
    duplicateListIds,
    generalFeatureOptions,
    goToNextStep,
    goToPreviousStep,
    handleAddMedia,
    handleCreateList,
    handleMediaPress,
    handleMoveMedia,
    handlePickListCover,
    handleRemoveMedia,
    handleSave,
    isAddingMedia,
    isCreatingList,
    isPickingListCover,
    isSaving,
    listSelectionNotice,
    priceRangeIsValid,
    selectedMediaIndex,
    toggleAtmosphere,
    toggleBestTime,
    toggleCategory,
    toggleFeature,
    toggleList,
  };
}
