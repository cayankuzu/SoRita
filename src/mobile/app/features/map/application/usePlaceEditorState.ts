import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import {
  PLACE_CATEGORY_META,
  PLACE_DIETARY_OPTIONS,
  PLACE_FEATURE_OPTIONS,
} from '@/mobile/app/catalog/placeOptions';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import {
  buildPlaceEditorDraft,
  buildPlaceSavePayload,
  buildPreviewBestTimes,
  buildPreviewCategories,
  buildPreviewDietaryOptions,
  buildPreviewGeneralFeatures,
  buildPreviewPlace,
  buildPreviewPriceLabel,
} from '@/mobile/app/features/map/application/placeEditorPreview';
import {
  PHOTO_TILE_STRIDE,
  buildEditorSourceKey,
  filterSafeSelectedLists,
  getInitialBestTimes,
  getInitialSelectedCategories,
  getInitialSelectedLists,
  isEquivalentTargetPlace,
  reorderPhotos,
  sortSelectedCategories,
  toggleArrayValue,
} from '@/mobile/app/features/map/application/placeEditorStateUtils';
import { MAX_PLACE_PHOTOS } from '@/mobile/app/features/map/catalog/placeEditor';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { pickSingleImage } from '@/mobile/app/platform/media/images';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  MAX_SELECTED_LISTS_PER_PLACE_SAVE,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  clampTextLength,
} from '@/mobile/app/shared/validation/contentLimits';
import { createUuid } from '@/shared/utils/id';

type UsePlaceEditorStateParams = {
  visible: boolean;
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
  lists: PlaceList[];
  existingPlace?: Place | null;
  draft?: PlaceEditorDraft | null;
  onSave: (place: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => Promise<void> | void;
  onCreateList?: (list: PlaceList) => Promise<void> | void;
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallbackMessage;
}

function sanitizeNumericInput(value: string) {
  return value.replace(/[^\d]/g, '');
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
  onCreateList,
}: UsePlaceEditorStateParams) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(placeName || '');
  const [title, setTitle] = useState(existingPlace?.title || '');
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
  const [photos, setPhotos] = useState<string[]>(existingPlace?.photos || []);
  const [bestTimes, setBestTimes] = useState<string[]>(getInitialBestTimes(existingPlace));
  const [atmosphere, setAtmosphere] = useState<string[]>(existingPlace?.atmosphere || []);
  const [features, setFeatures] = useState<string[]>(existingPlace?.specialFeatures || []);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListCoverImage, setNewListCoverImage] = useState('');
  const [newListPublic, setNewListPublic] = useState(true);
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null);
  const [listSelectionNotice, setListSelectionNotice] = useState<string | null>(null);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isPickingListCover, setIsPickingListCover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const draggingPhotoIndexRef = useRef<number | null>(null);
  const photoTouchStartXRef = useRef<number | null>(null);
  const activePhotoTouchIndexRef = useRef<number | null>(null);
  const photoDragX = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);
  const initSourceKeyRef = useRef<string | null>(null);
  const lastIncomingNameRef = useRef(placeName || existingPlace?.name || '');
  const lastIncomingAddressRef = useRef(placeAddress || existingPlace?.address || '');
  const hasShownMultiListGuidanceRef = useRef(false);
  const listSelectionNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      clearListSelectionNotice();
      return;
    }

    if (draft) {
      wasVisibleRef.current = true;
      initSourceKeyRef.current = `draft:${draft.step}:${draft.name}:${draft.address}`;
      lastIncomingNameRef.current = draft.name;
      lastIncomingAddressRef.current = draft.address;
      setStep(draft.step);
      setName(draft.name);
      setTitle(draft.title);
      setAddress(draft.address);
      setNotes(draft.notes);
      setSelectedCategories(draft.selectedCategories);
      setRating(draft.rating);
      setStudentFriendly(draft.studentFriendly);
      setPriceMin(draft.priceMin);
      setPriceMax(draft.priceMax);
      setSelectedLists(draft.selectedLists);
      setPhotos(draft.photos);
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
      setAddress(incomingAddress);
      setNotes(existingPlace?.notes || '');
      setSelectedCategories(getInitialSelectedCategories(existingPlace));
      setRating(existingPlace?.rating || 0);
      setStudentFriendly(Boolean(existingPlace?.studentDiscount));
      setPriceMin(existingPlace?.priceMin != null ? String(existingPlace.priceMin) : '');
      setPriceMax(existingPlace?.priceMax != null ? String(existingPlace.priceMax) : '');
      setPhotos(existingPlace?.photos || []);
      setBestTimes(getInitialBestTimes(existingPlace));
      setAtmosphere(existingPlace?.atmosphere || []);
      setFeatures(existingPlace?.specialFeatures || []);
      setSelectedLists(getInitialSelectedLists(existingPlace, lists));
      setNewListName('');
      setNewListDescription('');
      setNewListCoverImage('');
      setNewListPublic(true);
      setShowNewListForm(false);
    }

    setDraggingPhotoIndex(null);
  }, [clearListSelectionNotice, draft, existingPlace, lat, lng, placeAddress, placeName, visible]);

  useEffect(() => {
    draggingPhotoIndexRef.current = draggingPhotoIndex;

    if (draggingPhotoIndex == null) {
      photoDragX.setValue(0);
    }
  }, [draggingPhotoIndex, photoDragX]);

  const dietarySelections = useMemo(
    () => features.filter((item) => PLACE_DIETARY_OPTIONS.includes(item)),
    [features],
  );

  const generalFeatureOptions = useMemo(
    () => PLACE_FEATURE_OPTIONS.filter((item) => !PLACE_DIETARY_OPTIONS.includes(item)),
    [],
  );

  const targetPlaceIdentity = useMemo(
    () => ({
      id: existingPlace?.id ?? null,
      name: name.trim() || placeName || existingPlace?.name,
      lat,
      lng,
    }),
    [existingPlace?.id, existingPlace?.name, lat, lng, name, placeName],
  );

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
    () =>
      new Set(
        lists
          .filter((list) =>
            list.places.some((place) => isEquivalentTargetPlace(place, targetPlaceIdentity)),
          )
          .map((list) => list.id),
      ),
    [lists, targetPlaceIdentity],
  );

  useEffect(() => {
    setSelectedLists((prev) =>
      prev.filter((listId) => !duplicateListIds.has(listId) || currentMembershipListIds.has(listId)),
    );
  }, [currentMembershipListIds, duplicateListIds]);

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
          ? 'Devam etmek icin en az bir hedef liste sec.'
          : showNewListForm && newListName.trim()
            ? 'Devam etmek icin once listeyi olustur ve sec.'
            : 'Devam etmek icin once bir liste olustur.',
      );
    }
  }, [hasTargetListSelection, lists.length, newListName, showListSelectionNotice, showNewListForm]);

  const handleNameChange = useCallback((value: string) => {
    setName(clampTextLength(value, PLACE_NAME_MAX_LENGTH));
  }, []);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(clampTextLength(value, PLACE_TITLE_MAX_LENGTH));
  }, []);

  const handleAddressChange = useCallback((value: string) => {
    setAddress(clampTextLength(value, PLACE_ADDRESS_MAX_LENGTH));
  }, []);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(clampTextLength(value, PLACE_NOTES_MAX_LENGTH));
  }, []);

  const handleNewListNameChange = useCallback((value: string) => {
    setNewListName(clampTextLength(value, LIST_NAME_MAX_LENGTH));
  }, []);

  const handleNewListDescriptionChange = useCallback((value: string) => {
    setNewListDescription(clampTextLength(value, LIST_DESCRIPTION_MAX_LENGTH));
  }, []);

  const handlePriceMinChange = useCallback((value: string) => {
    setPriceMin(sanitizeNumericInput(value));
  }, []);

  const handlePriceMaxChange = useCallback((value: string) => {
    setPriceMax(sanitizeNumericInput(value));
  }, []);

  const canContinue = useMemo(() => {
    if (step === 2 || step === 3) {
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
      showListSelectionNotice(
        `Bir mekani ayni anda en fazla ${MAX_SELECTED_LISTS_PER_PLACE_SAVE} listeye ekleyebilirsin.`,
      );
      return;
    }

    if (shouldShowMultiListGuidance) {
      hasShownMultiListGuidanceRef.current = true;
      showListSelectionNotice(
        'Ayni mekani birden fazla listeye ekleyebilirsin. Daha ozgun kartlar icin listelerine ayri ayri ekleyip bilgileri ozellestirmeni oneririz.',
      );
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

  const handleAddPhoto = useCallback(async () => {
    if (isAddingPhoto) {
      return;
    }

    setIsAddingPhoto(true);

    try {
      const uri = await pickSingleImage();

      if (uri) {
        setPhotos((prev) => [...prev, uri].slice(0, MAX_PLACE_PHOTOS));
      }
    } finally {
      setIsAddingPhoto(false);
    }
  }, [isAddingPhoto]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

    if (draggingPhotoIndexRef.current === index) {
      draggingPhotoIndexRef.current = null;
      setDraggingPhotoIndex(null);
    } else if (draggingPhotoIndexRef.current != null && draggingPhotoIndexRef.current > index) {
      const nextIndex = draggingPhotoIndexRef.current - 1;
      draggingPhotoIndexRef.current = nextIndex;
      setDraggingPhotoIndex(nextIndex);
    }
  }, []);

  const finishPhotoDrag = useCallback(() => {
    draggingPhotoIndexRef.current = null;
    photoTouchStartXRef.current = null;
    activePhotoTouchIndexRef.current = null;
    photoDragX.setValue(0);
    setDraggingPhotoIndex(null);
  }, [photoDragX]);

  const handlePhotoTouchStart = useCallback((index: number, event: GestureResponderEvent) => {
    activePhotoTouchIndexRef.current = index;
    photoTouchStartXRef.current = event.nativeEvent.pageX;
  }, []);

  const handlePhotoLongPress = useCallback((index: number) => {
    if (activePhotoTouchIndexRef.current !== index) {
      activePhotoTouchIndexRef.current = index;
    }

    photoDragX.setValue(0);
    draggingPhotoIndexRef.current = index;
    setDraggingPhotoIndex(index);
  }, [photoDragX]);

  const handlePhotoTouchMove = useCallback((index: number, event: GestureResponderEvent) => {
    if (draggingPhotoIndexRef.current !== index || photoTouchStartXRef.current == null) {
      return;
    }

    photoDragX.setValue(event.nativeEvent.pageX - photoTouchStartXRef.current);
  }, [photoDragX]);

  const handlePhotoTouchEnd = useCallback((index: number, event?: GestureResponderEvent) => {
    const startX = photoTouchStartXRef.current;

    if (draggingPhotoIndexRef.current === index && startX != null) {
      const endX = event?.nativeEvent.pageX ?? startX;
      const stepOffset = Math.round((endX - startX) / PHOTO_TILE_STRIDE);
      const targetIndex = Math.max(0, Math.min(photos.length - 1, index + stepOffset));

      setPhotos((prev) => reorderPhotos(prev, index, targetIndex));
    }

    finishPhotoDrag();
  }, [finishPhotoDrag, photos.length]);

  const selectedPreviewList = useMemo(
    () => lists.find((list) => selectedLists.includes(list.id)) ?? null,
    [lists, selectedLists],
  );

  const previewPlace = useMemo<Place>(
    () =>
      buildPreviewPlace({
        existingPlace,
        name,
        title,
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
        photos,
        placeName,
      }),
    [
      address,
      atmosphere,
      bestTimes,
      existingPlace?.addedAt,
      existingPlace?.addedBy,
      existingPlace?.id,
      features,
      lat,
      lng,
      name,
      notes,
      photos,
      placeAddress,
      placeName,
      priceMax,
      priceMin,
      rating,
      selectedCategories,
      studentFriendly,
      title,
    ],
  );

  const previewCategories = useMemo(
    () => buildPreviewCategories(previewPlace),
    [previewPlace.category, previewPlace.categories],
  );

  const previewBestTimes = useMemo(
    () => buildPreviewBestTimes(previewPlace),
    [previewPlace.bestTime, previewPlace.bestTimes],
  );

  const previewDietaryOptions = useMemo(
    () => buildPreviewDietaryOptions(previewPlace),
    [previewPlace.specialFeatures],
  );

  const previewGeneralFeatures = useMemo(
    () => buildPreviewGeneralFeatures(previewPlace),
    [previewPlace.specialFeatures],
  );

  const previewPriceLabel = useMemo(() => buildPreviewPriceLabel(previewPlace), [previewPlace]);

  const buildDraft = useCallback(
    (): PlaceEditorDraft =>
      buildPlaceEditorDraft({
        step,
        name,
        title,
        address,
        notes,
        selectedCategories,
        rating,
        studentFriendly,
        priceMin,
        priceMax,
        selectedLists,
        photos,
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
      newListCoverImage,
      newListDescription,
      newListName,
      newListPublic,
      notes,
      photos,
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
      const uri = await pickSingleImage();

      if (uri) {
        setNewListCoverImage(uri);
      }
    } finally {
      setIsPickingListCover(false);
    }
  }, [isPickingListCover]);

  const createPendingList = useCallback(async () => {
    if (isCreatingList || !onCreateList) {
      return null;
    }

    const normalizedNewListName = clampTextLength(newListName, LIST_NAME_MAX_LENGTH).trim();
    const normalizedNewListDescription = clampTextLength(
      newListDescription,
      LIST_DESCRIPTION_MAX_LENGTH,
    ).trim();

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

        if (
          prev.includes(newListId) ||
          pendingSelectionCount >= MAX_SELECTED_LISTS_PER_PLACE_SAVE
        ) {
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
          `Liste olusturuldu. Ayni anda en fazla ${MAX_SELECTED_LISTS_PER_PLACE_SAVE} yeni liste secilebildigi icin otomatik secilmedi.`,
        );
      }

      return newListId;
    } catch (error) {
      logger.error('place-editor', 'Failed to create list', error);
      showToast(getErrorMessage(error, 'Liste olusturulamadi'), 'error');
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

    try {
      setIsSaving(true);
      if (pendingAddedListCount > MAX_SELECTED_LISTS_PER_PLACE_SAVE) {
        showListSelectionNotice(
          `Bir mekani ayni anda en fazla ${MAX_SELECTED_LISTS_PER_PLACE_SAVE} listeye ekleyebilirsin.`,
        );
        return;
      }

      const targetListIds = safeSelectedLists;

      if (targetListIds.length === 0) {
        showValidationFeedback();
        return;
      }

      await onSave(
        buildPlaceSavePayload({
          existingPlace,
          name,
          title,
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
          photos,
          placeName,
        }),
        targetListIds,
      );
    } catch (error) {
      const fallbackMessage = existingPlace ? 'Mekan guncellenemedi' : 'Mekan kaydedilemedi';
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : fallbackMessage;

      showToast(message || fallbackMessage, 'error');
    } finally {
      setIsSaving(false);
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
    name,
    notes,
    onSave,
    placeAddress,
    placeName,
    pendingAddedListCount,
    photos,
    priceMax,
    priceMin,
    rating,
    safeSelectedLists,
    selectedCategories,
    showValidationFeedback,
    studentFriendly,
    title,
    isCreatingList,
    isSaving,
  ]);

  const goToPreviousStep = useCallback(() => {
    setStep((value) => Math.max(0, value - 1));
  }, []);

  const goToNextStep = useCallback(() => {
    if (!canContinue) {
      showValidationFeedback();
      return;
    }

    setStep((value) => value + 1);
  }, [canContinue, showValidationFeedback]);

  return {
    address,
    atmosphere,
    bestTimes,
    buildDraft,
    canContinue,
    currentMembershipListIds,
    dietarySelections,
    draggingPhotoIndex,
    duplicateListIds,
    features,
    generalFeatureOptions,
    goToNextStep,
    goToPreviousStep,
    handleAddPhoto,
    handleCreateList,
    handlePhotoLongPress,
    handlePhotoTouchEnd,
    handlePhotoTouchMove,
    handlePhotoTouchStart,
    handlePickListCover,
    handleRemovePhoto,
    handleSave,
    isAddingPhoto,
    isCreatingList,
    isPickingListCover,
    isSaving,
    listSelectionNotice,
    name,
    newListCoverImage,
    newListDescription,
    newListName,
    newListPublic,
    notes,
    photoDragX,
    photos,
    previewBestTimes,
    previewCategories,
    previewDietaryOptions,
    previewGeneralFeatures,
    previewPlace,
    previewPriceLabel,
    priceMax,
    priceMin,
    rating,
    selectedCategories,
    selectedLists,
    selectedPreviewList,
    setAddress: handleAddressChange,
    setAtmosphere,
    setBestTimes,
    setFeatures,
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
    toggleAtmosphere,
    toggleBestTime,
    toggleCategory,
    toggleFeature,
    toggleList,
  };
}
