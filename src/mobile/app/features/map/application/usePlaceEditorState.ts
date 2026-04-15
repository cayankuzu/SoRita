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
import { pickSingleImage } from '@/mobile/app/platform/media/images';
import { tr } from '@/mobile/app/shared/i18n/tr';
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

  const draggingPhotoIndexRef = useRef<number | null>(null);
  const photoTouchStartXRef = useRef<number | null>(null);
  const activePhotoTouchIndexRef = useRef<number | null>(null);
  const photoDragX = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);
  const initSourceKeyRef = useRef<string | null>(null);
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
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (listSelectionNoticeTimeoutRef.current) {
        clearTimeout(listSelectionNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      initSourceKeyRef.current = null;
      clearListSelectionNotice();
      return;
    }

    if (draft) {
      wasVisibleRef.current = true;
      initSourceKeyRef.current = `draft:${draft.step}:${draft.name}:${draft.address}`;
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
        return;
      }

      wasVisibleRef.current = true;
      initSourceKeyRef.current = sourceKey;
      setStep(0);
      setName(placeName || existingPlace?.name || '');
      setTitle(existingPlace?.title || '');
      setAddress(placeAddress || existingPlace?.address || '');
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

  const selectableLists = useMemo(
    () => lists.filter((list) => !duplicateListIds.has(list.id) || currentMembershipListIds.has(list.id)),
    [currentMembershipListIds, duplicateListIds, lists],
  );

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

  const hasValidName = name.trim().length >= 2;
  const hasPendingListCreation = Boolean(onCreateList && showNewListForm && newListName.trim());
  const hasTargetListSelection = safeSelectedLists.length > 0 || hasPendingListCreation;

  useEffect(() => {
    if (!visible || showNewListForm || safeSelectedLists.length > 0) {
      return;
    }

    const firstSelectableList = selectableLists[0];

    if (firstSelectableList) {
      setSelectedLists([firstSelectableList.id]);
    }
  }, [safeSelectedLists.length, selectableLists, showNewListForm, visible]);

  const showValidationFeedback = useCallback(() => {
    if (!hasValidName) {
      showToast('Mekan adi en az 2 karakter olmali', 'error');
      return;
    }

    if (!hasTargetListSelection) {
      showListSelectionNotice(
        lists.length > 0
          ? 'Kaydetmek icin en az bir hedef liste sec.'
          : 'Kaydetmek icin once bir liste olustur.',
      );
    }
  }, [hasTargetListSelection, hasValidName, lists.length, showListSelectionNotice]);

  const canContinue = useMemo(() => {
    if (step === 0) {
      return hasValidName;
    }

    if (step === 2 || step === 3) {
      return hasValidName && hasTargetListSelection;
    }

    return true;
  }, [hasTargetListSelection, hasValidName, step]);

  const toggleList = useCallback((listId: string, options?: { blocked?: boolean; listName?: string }) => {
    if (options?.blocked) {
      showListSelectionNotice(
        tr.placeEditor.duplicateListSelectionBlocked(
          options.listName || tr.placeEditor.duplicateListBadge,
        ),
      );
      return;
    }

    setSelectedLists((prev) =>
      prev.includes(listId) ? prev.filter((item) => item !== listId) : [...prev, listId],
    );
  }, [showListSelectionNotice]);

  const toggleCategory = useCallback((value: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(value)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== value);
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
    const uri = await pickSingleImage();

    if (uri) {
      setPhotos((prev) => [...prev, uri].slice(0, MAX_PLACE_PHOTOS));
    }
  }, []);

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
    const uri = await pickSingleImage();

    if (uri) {
      setNewListCoverImage(uri);
    }
  }, []);

  const createPendingList = useCallback(async () => {
    if (!newListName.trim() || !onCreateList) {
      return null;
    }

    const newListId = createUuid();
    const list: PlaceList = {
      id: newListId,
      userId: '',
      name: newListName.trim(),
      description: newListDescription.trim() || undefined,
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
      await onCreateList(list);
      setSelectedLists((prev) => (prev.includes(newListId) ? prev : [...prev, newListId]));
      setShowNewListForm(false);
      setNewListName('');
      setNewListDescription('');
      setNewListCoverImage('');
      setNewListPublic(true);
      showToast(tr.placeEditor.newListCreated, 'success');
      return newListId;
    } catch {
      showToast('Liste olusturulamadi', 'error');
      return null;
    }
  }, [newListCoverImage, newListDescription, newListName, newListPublic, onCreateList]);

  const handleCreateList = useCallback(async () => {
    await createPendingList();
  }, [createPendingList]);

  const handleSave = useCallback(async () => {
    if (!canContinue) {
      showValidationFeedback();
      return;
    }

    try {
      let targetListIds = safeSelectedLists;

      if (targetListIds.length === 0 && hasPendingListCreation) {
        const createdListId = await createPendingList();
        targetListIds = createdListId ? [createdListId] : [];
      }

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
    }
  }, [
    address,
    atmosphere,
    bestTimes,
    canContinue,
    createPendingList,
    existingPlace,
    features,
    hasPendingListCreation,
    lat,
    lng,
    name,
    notes,
    onSave,
    placeAddress,
    placeName,
    photos,
    priceMax,
    priceMin,
    rating,
    safeSelectedLists,
    selectedCategories,
    showValidationFeedback,
    studentFriendly,
    title,
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
    setAddress,
    setAtmosphere,
    setBestTimes,
    setFeatures,
    setName,
    setNewListCoverImage,
    setNewListDescription,
    setNewListName,
    setNewListPublic,
    setNotes,
    setPriceMax,
    setPriceMin,
    setRating,
    setShowNewListForm,
    setStudentFriendly,
    setTitle,
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
