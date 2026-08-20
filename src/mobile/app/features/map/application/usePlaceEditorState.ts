import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  PLACE_DIETARY_OPTIONS,
  PLACE_FEATURE_OPTIONS,
} from '@/mobile/app/catalog/placeOptions';
import type { Place, PlaceList, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import type {
  PlaceEditorSaveOptions,
  PlaceEditorSaveStartHandler,
} from '@/mobile/app/features/map/application/placeEditorSaveTypes';
import {
  buildPlaceEditorDraft,
  buildPlaceSavePayload,
} from '@/mobile/app/features/map/application/placeEditorPreview';
import {
  buildEditorSourceKey,
  filterSafeSelectedLists,
  getInitialBestTimes,
  getInitialSelectedCategories,
  getInitialSelectedLists,
  sortSelectedCategories,
  toggleArrayValue,
} from '@/mobile/app/features/map/application/placeEditorStateUtils';
import {
  appendPlaceMediaWithinLimits,
  replacePlaceMediaWithinLimits,
  usePlaceEditorMediaController,
  type MediaSelectionIssueSummary,
} from '@/mobile/app/features/map/application/usePlaceEditorMediaController';
import {
  MAX_PLACE_MEDIA_ITEMS,
  MAX_PLACE_PHOTOS,
  MAX_PLACE_VIDEOS,
} from '@/mobile/app/features/map/catalog/placeEditor';
import { useAppProgressBanner } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  pickSingleImageFromPrompt,
} from '@/mobile/app/platform/media/images';
import { waitForMediaPickerTransition } from '@/mobile/app/platform/media/mediaPickerTransition';
import {
  findFirstOversizedPlaceMedia,
  PLACE_MEDIA_MAX_FILE_SIZE_MB,
} from '@/mobile/app/platform/media/placeMediaSize';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  getPlaceMedia,
  getPlacePhotoUrls,
} from '@/mobile/app/shared/utils/placeMedia';
import {
  clampMultilineTextLength,
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  MAX_SELECTED_LISTS_PER_PLACE_SAVE,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_MENU_URL_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  clampTextLength,
  trimPreservingLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';
import { normalizeSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';
import { createUuid } from '@/shared/utils/id';
import { isAbortError } from '@/mobile/app/shared/utils/abort';

const PLACE_EDITOR_STEP_COUNT = 3;
const LAST_PLACE_EDITOR_STEP_INDEX = PLACE_EDITOR_STEP_COUNT - 1;

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

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallbackMessage;
}

function sanitizeNumericInput(value: string) {
  return value.replace(/[^\d]/g, '');
}

type EditorBlockingNotice = {
  description: string;
  title: string;
};

// Narrow pure-function surface for exhaustive media-limit contract tests.
export const placeEditorInternals = {
  appendPlaceMediaWithinLimits,
  getErrorMessage,
  replacePlaceMediaWithinLimits,
  sanitizeNumericInput,
};

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
  const [step, setStep] = useState(0);
  const [name, setName] = useState(placeName || '');
  const [title, setTitle] = useState(existingPlace?.title || '');
  const [menuUrl, setMenuUrl] = useState(existingPlace?.menuUrl || '');
  const [address, setAddress] = useState(placeAddress || existingPlace?.address || '');
  const [notes, setNotes] = useState(existingPlace?.notes || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    getInitialSelectedCategories(existingPlace),
  );
  const [rating, setRating] = useState(existingPlace?.rating || 0);
  const [studentFriendly, setStudentFriendly] = useState(Boolean(existingPlace?.studentDiscount));
  const [priceMin, setPriceMin] = useState(existingPlace?.priceMin ? String(existingPlace.priceMin) : '');
  const [priceMax, setPriceMax] = useState(existingPlace?.priceMax ? String(existingPlace.priceMax) : '');
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [media, setMedia] = useState<PlaceMedia[]>(getPlaceMedia(existingPlace));
  const [bestTimes, setBestTimes] = useState<string[]>(getInitialBestTimes(existingPlace));
  const [atmosphere, setAtmosphere] = useState<string[]>(existingPlace?.atmosphere || []);
  const [features, setFeatures] = useState<string[]>(existingPlace?.specialFeatures || []);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListCoverImage, setNewListCoverImage] = useState('');
  const [newListPublic, setNewListPublic] = useState(true);
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [blockingNotice, setBlockingNotice] = useState<EditorBlockingNotice | null>(null);
  const [listSelectionNotice, setListSelectionNotice] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isPickingListCover, setIsPickingListCover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { beginProgress } = useAppProgressBanner();

  const wasVisibleRef = useRef(false);
  const initSourceKeyRef = useRef<string | null>(null);
  const lastIncomingNameRef = useRef(placeName || existingPlace?.name || '');
  const lastIncomingAddressRef = useRef(placeAddress || existingPlace?.address || '');
  const hasShownMultiListGuidanceRef = useRef(false);
  const blockingNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listSelectionNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const clearBlockingNotice = useCallback(() => {
    if (blockingNoticeTimeoutRef.current) {
      clearTimeout(blockingNoticeTimeoutRef.current);
      blockingNoticeTimeoutRef.current = null;
    }

    setBlockingNotice(null);
  }, []);

  const showBlockingNotice = useCallback((notice: EditorBlockingNotice) => {
    if (blockingNoticeTimeoutRef.current) {
      clearTimeout(blockingNoticeTimeoutRef.current);
    }

    setBlockingNotice(notice);
    blockingNoticeTimeoutRef.current = setTimeout(() => {
      blockingNoticeTimeoutRef.current = null;
      setBlockingNotice(null);
    }, 2800);
  }, []);

  const clearListSelectionNotice = useCallback(() => {
    if (listSelectionNoticeTimeoutRef.current) {
      clearTimeout(listSelectionNoticeTimeoutRef.current);
      listSelectionNoticeTimeoutRef.current = null;
    }

    setListSelectionNotice(null);
  }, []);

  const showListSelectionNotice = useCallback((message: string) => {
    if (listSelectionNoticeTimeoutRef.current) {
      clearTimeout(listSelectionNoticeTimeoutRef.current);
    }

    setListSelectionNotice(message);
    listSelectionNoticeTimeoutRef.current = setTimeout(() => {
      listSelectionNoticeTimeoutRef.current = null;
      setListSelectionNotice(null);
    }, 3400);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      if (blockingNoticeTimeoutRef.current) {
        clearTimeout(blockingNoticeTimeoutRef.current);
      }

      if (listSelectionNoticeTimeoutRef.current) {
        clearTimeout(listSelectionNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const incomingName = placeName || existingPlace?.name || '';
    const incomingAddress = placeAddress || existingPlace?.address || '';

    if (!visible) {
      wasVisibleRef.current = false;
      initSourceKeyRef.current = null;
      lastIncomingNameRef.current = incomingName;
      lastIncomingAddressRef.current = incomingAddress;
      hasShownMultiListGuidanceRef.current = false;
      clearBlockingNotice();
      clearListSelectionNotice();
      return;
    }

    if (draft) {
      wasVisibleRef.current = true;
      initSourceKeyRef.current = `draft:${draft.step}:${draft.name}:${draft.address}`;
      lastIncomingNameRef.current = draft.name;
      lastIncomingAddressRef.current = draft.address;
      setStep(Math.min(draft.step, LAST_PLACE_EDITOR_STEP_INDEX));
      setName(draft.name);
      setTitle(draft.title);
      setMenuUrl(draft.menuUrl || '');
      setAddress(draft.address);
      setNotes(draft.notes);
      setSelectedCategories(draft.selectedCategories);
      setRating(draft.rating);
      setStudentFriendly(draft.studentFriendly);
      setPriceMin(draft.priceMin);
      setPriceMax(draft.priceMax);
      setSelectedLists(draft.selectedLists);
      setMedia(getPlaceMedia({ media: draft.media, photos: draft.photos }));
      setBestTimes(draft.bestTimes);
      setAtmosphere(draft.atmosphere);
      setFeatures(draft.features);
      setNewListName(draft.newListName);
      setNewListDescription(draft.newListDescription);
      setNewListCoverImage(draft.newListCoverImage);
      setNewListPublic(draft.newListPublic);
      setShowNewListForm(draft.showNewListForm);
    } else {
      const sourceKey = buildEditorSourceKey({
        existingPlace,
        lat,
        lng,
        placeName,
        placeAddress,
      });

      if (wasVisibleRef.current && initSourceKeyRef.current === sourceKey) {
        const previousIncomingName = lastIncomingNameRef.current;
        const previousIncomingAddress = lastIncomingAddressRef.current;

        if (incomingName !== previousIncomingName) {
          setName((prev) => (!prev.trim() || prev === previousIncomingName ? incomingName : prev));
        }

        if (incomingAddress !== previousIncomingAddress) {
          setAddress((prev) =>
            !prev.trim() || prev === previousIncomingAddress ? incomingAddress : prev,
          );
        }

        lastIncomingNameRef.current = incomingName;
        lastIncomingAddressRef.current = incomingAddress;
        return;
      }

      wasVisibleRef.current = true;
      initSourceKeyRef.current = sourceKey;
      lastIncomingNameRef.current = incomingName;
      lastIncomingAddressRef.current = incomingAddress;
      setStep(0);
      setName(incomingName);
      setTitle(existingPlace?.title || '');
      setMenuUrl(existingPlace?.menuUrl || '');
      setAddress(incomingAddress);
      setNotes(existingPlace?.notes || '');
      setSelectedCategories(getInitialSelectedCategories(existingPlace));
      setRating(existingPlace?.rating || 0);
      setStudentFriendly(Boolean(existingPlace?.studentDiscount));
      setPriceMin(existingPlace?.priceMin != null ? String(existingPlace.priceMin) : '');
      setPriceMax(existingPlace?.priceMax != null ? String(existingPlace.priceMax) : '');
      setMedia(getPlaceMedia(existingPlace));
      setBestTimes(getInitialBestTimes(existingPlace));
      setAtmosphere(existingPlace?.atmosphere || []);
      setFeatures(existingPlace?.specialFeatures || []);
      setSelectedLists(getInitialSelectedLists(existingPlace, listsRef.current));
      setNewListName('');
      setNewListDescription('');
      setNewListCoverImage('');
      setNewListPublic(true);
      setShowNewListForm(false);
    }
  }, [clearBlockingNotice, clearListSelectionNotice, draft, existingPlace, lat, lng, placeAddress, placeName, visible]);

  const dietarySelections = useMemo(
    () => features.filter((item) => PLACE_DIETARY_OPTIONS.includes(item)),
    [features],
  );

  const generalFeatureOptions = useMemo(
    () => PLACE_FEATURE_OPTIONS.filter((item) => !PLACE_DIETARY_OPTIONS.includes(item)),
    [],
  );
  const photoUris = useMemo(() => getPlacePhotoUrls({ media }), [media]);

  const currentMembershipListIds = useMemo(
    () =>
      new Set(
        existingPlace
          ? lists
              .filter((list) => list.places.some((place) => place.id === existingPlace.id))
              .map((list) => list.id)
          : [],
      ),
    [existingPlace, lists],
  );

  const duplicateListIds = useMemo(
    () => new Set<string>(),
    [],
  );

  const availableListIds = useMemo(() => new Set(lists.map((list) => list.id)), [lists]);

  const safeSelectedLists = useMemo(
    () =>
      filterSafeSelectedLists(
        selectedLists,
        duplicateListIds,
        currentMembershipListIds,
        availableListIds,
      ),
    [availableListIds, currentMembershipListIds, duplicateListIds, selectedLists],
  );
  const pendingAddedListCount = useMemo(
    () => safeSelectedLists.filter((listId) => !currentMembershipListIds.has(listId)).length,
    [currentMembershipListIds, safeSelectedLists],
  );

  const hasTargetListSelection = safeSelectedLists.length > 0;

  const showValidationFeedback = useCallback(() => {
    if (!hasTargetListSelection) {
      showListSelectionNotice(
        lists.length > 0
          ? tr.placeEditor.notices.listSelectionRequired
          : showNewListForm && newListName.trim()
            ? tr.placeEditor.notices.createListFirst
            : tr.placeEditor.notices.createOrSelectList,
      );
    }
  }, [hasTargetListSelection, lists.length, newListName, showListSelectionNotice, showNewListForm]);

  const showMediaSelectionFeedback = useCallback(
    (
      issues: MediaSelectionIssueSummary,
      rejectedVideoDurationCount = 0,
      rejectedOversizeCount = 0,
    ) => {
      if (rejectedOversizeCount > 0) {
        showBlockingNotice({
          description: tr.placeEditor.mediaSizeLimitPopupDescription(PLACE_MEDIA_MAX_FILE_SIZE_MB),
          title: tr.placeEditor.mediaSizeLimitPopupTitle,
        });
        return;
      }

      if (rejectedVideoDurationCount > 0) {
        showToast(tr.placeEditor.videoDurationLimitExceeded, 'error');
        return;
      }

      if (issues.rejectedVideos > 0) {
        showToast(tr.placeEditor.videoLimitNotice(MAX_PLACE_VIDEOS), 'error');
        return;
      }

      if (issues.rejectedPhotos > 0) {
        showToast(tr.placeEditor.photoLimitNotice(MAX_PLACE_PHOTOS), 'error');
        return;
      }

      if (issues.rejectedTotal > 0) {
        showToast(tr.placeEditor.mediaLimitNotice(MAX_PLACE_MEDIA_ITEMS), 'error');
      }
    },
    [showBlockingNotice],
  );

  const {
    applyVideoThumbnail,
    closeVideoThumbnailEditor,
    editingVideoThumbnailIndex,
    handleAddMedia,
    handleEditMedia,
    handleMediaPress,
    handleRemoveMedia,
    isAddingMedia,
    openVideoThumbnailEditor,
    resetMediaInteraction,
    selectedMediaIndex,
  } = usePlaceEditorMediaController({
    media,
    setMedia,
    showSelectionFeedback: showMediaSelectionFeedback,
  });

  useEffect(() => {
    resetMediaInteraction();
  }, [
    draft,
    existingPlace,
    lat,
    lng,
    placeAddress,
    placeName,
    resetMediaInteraction,
    visible,
  ]);

  const handleNameChange = useCallback((value: string) => {
    setName(clampTextLength(value, PLACE_NAME_MAX_LENGTH));
  }, []);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(clampMultilineTextLength(value, PLACE_TITLE_MAX_LENGTH));
  }, []);

  const handleAddressChange = useCallback((value: string) => {
    setAddress(clampTextLength(value, PLACE_ADDRESS_MAX_LENGTH));
  }, []);

  const handleMenuUrlChange = useCallback((value: string) => {
    setMenuUrl(clampTextLength(value, PLACE_MENU_URL_MAX_LENGTH));
  }, []);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(clampMultilineTextLength(value, PLACE_NOTES_MAX_LENGTH));
  }, []);

  const handleNewListNameChange = useCallback((value: string) => {
    setNewListName(clampTextLength(value, LIST_NAME_MAX_LENGTH));
  }, []);

  const handleNewListDescriptionChange = useCallback((value: string) => {
    setNewListDescription(clampMultilineTextLength(value, LIST_DESCRIPTION_MAX_LENGTH));
  }, []);

  const handlePriceMinChange = useCallback((value: string) => {
    setPriceMin(sanitizeNumericInput(value));
  }, []);

  const handlePriceMaxChange = useCallback((value: string) => {
    setPriceMax(sanitizeNumericInput(value));
  }, []);

  const canContinue = useMemo(() => {
    if (step === LAST_PLACE_EDITOR_STEP_INDEX) {
      return hasTargetListSelection;
    }

    return true;
  }, [hasTargetListSelection, step]);

  const toggleList = useCallback((listId: string, options?: { blocked?: boolean; listName?: string }) => {
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

    setSelectedLists((prev) => {
      if (prev.includes(listId)) {
        return prev.filter((item) => item !== listId);
      }

      if (!currentMembershipListIds.has(listId)) {
        const nextPendingAddedListCount = prev.filter(
          (item) => !currentMembershipListIds.has(item),
        ).length;

      if (nextPendingAddedListCount >= MAX_SELECTED_LISTS_PER_PLACE_SAVE) {
        blockedBySelectionLimit = true;
        return prev;
      }
      }

      const nextSelectedLists = [...prev, listId];

      if (nextSelectedLists.length > 1 && !hasShownMultiListGuidanceRef.current) {
        shouldShowMultiListGuidance = true;
      }

      return nextSelectedLists;
    });

    if (blockedBySelectionLimit) {
      showListSelectionNotice(tr.placeEditor.notices.selectionLimit(MAX_SELECTED_LISTS_PER_PLACE_SAVE));
      return;
    }

    if (shouldShowMultiListGuidance) {
      hasShownMultiListGuidanceRef.current = true;
      showListSelectionNotice(tr.placeEditor.notices.multiListHint);
    }
  }, [currentMembershipListIds, showListSelectionNotice]);

  const toggleCategory = useCallback((value: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }

      return sortSelectedCategories([...prev, value]);
    });
  }, []);

  const toggleBestTime = useCallback((value: string) => {
    toggleArrayValue(value, setBestTimes);
  }, []);

  const toggleAtmosphere = useCallback((value: string) => {
    toggleArrayValue(value, setAtmosphere);
  }, []);

  const toggleFeature = useCallback((value: string) => {
    toggleArrayValue(value, setFeatures);
  }, []);

  const buildDraft = useCallback(
    (): PlaceEditorDraft =>
      buildPlaceEditorDraft({
        step,
        name,
        title,
        menuUrl,
        address,
        notes,
        selectedCategories,
        rating,
        studentFriendly,
        priceMin,
        priceMax,
        selectedLists,
        media,
        bestTimes,
        atmosphere,
        features,
        newListName,
        newListDescription,
        newListCoverImage,
        newListPublic,
        showNewListForm,
      }),
    [
      address,
      atmosphere,
      bestTimes,
      features,
      name,
      menuUrl,
      media,
      newListCoverImage,
      newListDescription,
      newListName,
      newListPublic,
      notes,
      priceMax,
      priceMin,
      rating,
      selectedCategories,
      selectedLists,
      showNewListForm,
      step,
      studentFriendly,
      title,
    ],
  );

  const handlePickListCover = useCallback(async () => {
    if (isPickingListCover) {
      return;
    }

    setIsPickingListCover(true);

    try {
      await waitForMediaPickerTransition();

      const uri = await pickSingleImageFromPrompt({
        cropAspect: [16, 9],
        cropShape: 'rectangle',
      });

      if (uri) {
        setNewListCoverImage(uri);
      }
    } finally {
      await waitForMediaPickerTransition();
      setIsPickingListCover(false);
    }
  }, [isPickingListCover]);

  const createPendingList = useCallback(async () => {
    if (isCreatingList || !onCreateList) {
      return null;
    }

    const normalizedNewListName = clampTextLength(newListName, LIST_NAME_MAX_LENGTH).trim();
    const normalizedNewListDescription = trimPreservingLineBreaks(
      clampMultilineTextLength(
      newListDescription,
      LIST_DESCRIPTION_MAX_LENGTH,
      ),
    );

    if (!normalizedNewListName) {
      return null;
    }

    const newListId = createUuid();
    const list: PlaceList = {
      id: newListId,
      userId: '',
      name: normalizedNewListName,
      description: normalizedNewListDescription || undefined,
      emoji: tr.placeEditor.defaultEmoji,
      coverImage: newListCoverImage || undefined,
      places: [],
      isPublic: newListPublic,
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      setIsCreatingList(true);
      await onCreateList(list);
      let blockedBySelectionLimit = false;

      setSelectedLists((prev) => {
        const pendingSelectionCount = prev.filter(
          (listId) => !currentMembershipListIds.has(listId),
        ).length;

        if (pendingSelectionCount >= MAX_SELECTED_LISTS_PER_PLACE_SAVE) {
          blockedBySelectionLimit = true;
          return prev;
        }

        return [...prev, newListId];
      });
      setShowNewListForm(false);
      setNewListName('');
      setNewListDescription('');
      setNewListCoverImage('');
      setNewListPublic(true);
      showToast(tr.placeEditor.newListCreated, 'success');

      if (blockedBySelectionLimit) {
        showListSelectionNotice(
          tr.placeEditor.notices.listCreatedButNotSelected(MAX_SELECTED_LISTS_PER_PLACE_SAVE),
        );
      }

      return newListId;
    } catch (error) {
      logger.error('place-editor', 'Failed to create list', error);
      showToast(getErrorMessage(error, tr.placeEditor.listCreateFailed), 'error');
      return null;
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
    showListSelectionNotice,
  ]);

  const handleCreateList = useCallback(async () => {
    await createPendingList();
  }, [createPendingList]);

  const handleSave = useCallback(async () => {
    if (isSaving || isCreatingList || !canContinue) {
      showValidationFeedback();
      return;
    }

    if (pendingAddedListCount > MAX_SELECTED_LISTS_PER_PLACE_SAVE) {
      showListSelectionNotice(tr.placeEditor.notices.selectionLimit(MAX_SELECTED_LISTS_PER_PLACE_SAVE));
      return;
    }

    const targetListIds = safeSelectedLists;

    if (targetListIds.length === 0) {
      showValidationFeedback();
      return;
    }

    const oversizedMedia = await findFirstOversizedPlaceMedia(media);

    if (oversizedMedia) {
      showBlockingNotice({
        description: tr.placeEditor.mediaSizeLimitPopupDescription(PLACE_MEDIA_MAX_FILE_SIZE_MB),
        title: tr.placeEditor.mediaSizeLimitPopupTitle,
      });
      return;
    }

    const normalizedMenuUrl = clampTextLength(menuUrl, PLACE_MENU_URL_MAX_LENGTH).trim();
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
          existingPlace,
          name,
          title,
          menuUrl: safeMenuUrl || undefined,
          lat,
          lng,
          address,
          placeAddress,
          notes,
          rating,
          selectedCategories,
          studentFriendly,
          priceMin,
          priceMax,
          bestTimes,
          atmosphere,
          features,
          media,
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
    address,
    atmosphere,
    bestTimes,
    canContinue,
    existingPlace,
    features,
    lat,
    lng,
    menuUrl,
    name,
    notes,
    onSave,
    placeAddress,
    placeName,
    pendingAddedListCount,
    media,
    priceMax,
    priceMin,
    rating,
    safeSelectedLists,
    selectedCategories,
    showValidationFeedback,
    showBlockingNotice,
    showListSelectionNotice,
    studentFriendly,
    title,
    isCreatingList,
    isSaving,
    beginProgress,
    buildDraft,
    onSaveError,
    onSaveStart,
  ]);

  const goToPreviousStep = useCallback(() => {
    setStep((value) => Math.max(0, value - 1));
  }, []);

  const goToNextStep = useCallback(() => {
    if (!canContinue) {
      showValidationFeedback();
      return;
    }

    setStep((value) => Math.min(value + 1, LAST_PLACE_EDITOR_STEP_INDEX));
  }, [canContinue, showValidationFeedback]);

  return {
    address,
    atmosphere,
    bestTimes,
    buildDraft,
    canContinue,
    clearBlockingNotice,
    currentMembershipListIds,
    dietarySelections,
    duplicateListIds,
    features,
    generalFeatureOptions,
    goToNextStep,
    goToPreviousStep,
    blockingNotice,
    handleAddMedia,
    handleCreateList,
    handleEditMedia,
    handleMediaPress,
    handlePickListCover,
    handleRemoveMedia,
    handleSave,
    isAddingMedia,
    isCreatingList,
    isPickingListCover,
    isSaving,
    listSelectionNotice,
    menuUrl,
    name,
    newListCoverImage,
    newListDescription,
    newListName,
    newListPublic,
    media,
    notes,
    editingVideoThumbnailIndex,
    photos: photoUris,
    priceMax,
    priceMin,
    rating,
    selectedCategories,
    selectedLists,
    selectedMediaIndex,
    selectedPhotoIndex: selectedMediaIndex,
    setAddress: handleAddressChange,
    setAtmosphere,
    setBestTimes,
    setFeatures,
    setMenuUrl: handleMenuUrlChange,
    setName: handleNameChange,
    setNewListCoverImage,
    setNewListDescription: handleNewListDescriptionChange,
    setNewListName: handleNewListNameChange,
    setNewListPublic,
    setNotes: handleNotesChange,
    setPriceMax: handlePriceMaxChange,
    setPriceMin: handlePriceMinChange,
    setRating,
    setShowNewListForm,
    setStudentFriendly,
    setTitle: handleTitleChange,
    showNewListForm,
    step,
    studentFriendly,
    title,
    handleAddPhoto: handleAddMedia,
    handleEditPhoto: handleEditMedia,
    handlePhotoPress: handleMediaPress,
    handleRemovePhoto: handleRemoveMedia,
    isAddingPhoto: isAddingMedia,
    openVideoThumbnailEditor,
    applyVideoThumbnail,
    closeVideoThumbnailEditor,
    toggleAtmosphere,
    toggleBestTime,
    toggleCategory,
    toggleFeature,
    toggleList,
  };
}
