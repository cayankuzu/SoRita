import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppProgressBanner } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/contracts/placeEditorDraft';
import type {
  PlaceEditorSaveOptions,
  PlaceEditorSaveStartHandler,
} from '@/mobile/app/features/map/application/placeEditorSaveTypes';
import { usePlaceEditorState } from '@/mobile/app/features/map/application/usePlaceEditorState';
import { usePlaceEditorUnsavedChanges } from '@/mobile/app/features/map/ui/components/place-editor/usePlaceEditorUnsavedChanges';
import { PlaceEditorBasicsStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorBasicsStep';
import { PlaceEditorDetailsStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorDetailsStep';
import { PlaceEditorFinalStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorFinalStep';
import { PlaceEditorModalFooter } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalFooter';
import { PlaceEditorModalHeader } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalHeader';
import { PlaceEditorTransientNotice } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorTransientNotice';
import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { PlaceEditorWizardHeader } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorWizardHeader';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { MediaLightbox } from '@/mobile/app/shared/components/feedback/MediaLightbox';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import {
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import { dismissKeyboardAndRunAfterInteractions } from '@/mobile/app/shared/utils/interaction';
import { AppModal } from '@/mobile/app/shared/components/feedback/AppModal';

type PlaceEditorModalProps = {
  visible: boolean;
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
  lists: PlaceList[];
  existingPlace?: Place | null;
  existingPlaceListName?: string;
  isInteractionLocked?: boolean;
  onClose: () => void;
  onSave: (
    place: Omit<Place, 'id' | 'addedAt'>,
    targetListIds: string[],
    options?: PlaceEditorSaveOptions,
  ) => Promise<void> | void;
  onSaveError?: (draft: PlaceEditorDraft) => void;
  onSaveStart?: PlaceEditorSaveStartHandler;
  onDelete?: (placeId: string) => Promise<void> | void;
  onCreateList?: (list: PlaceList) => Promise<void> | void;
  draft?: PlaceEditorDraft | null;
  onMinimize?: (draft: PlaceEditorDraft) => void;
};

const wizardSteps = tr.placeEditor.steps;
const DISCARD_PLACE_EDITOR_CONFIRMATION = {
  description: tr.placeEditor.discardDescription,
  cancelLabel: tr.common.returnToEditing,
  confirmLabel: tr.common.cancelAction,
  title: tr.placeEditor.discardTitle,
} as const;

// How tall the editor sheet may be: most of the screen, less while the save
// progress banner needs room at the top.
function getEditorPanelHeight({
  isProgressBannerVisible,
  paddingBottom,
  paddingTop,
  windowHeight,
}: {
  isProgressBannerVisible: boolean;
  paddingBottom: number;
  paddingTop: number;
  windowHeight: number;
}) {
  const bannerReserve = Platform.OS === 'android' ? 212 : 176;
  const panelMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop,
    paddingBottom,
    minHeight: 310,
    ...(isProgressBannerVisible ? { reservedSpace: bannerReserve } : { maxHeightRatio: 0.88 }),
  });
  const preferredPanelHeight = Math.max(
    Math.round(windowHeight * (isProgressBannerVisible ? 0.76 : 0.84)),
    460,
  );

  return { panelHeight: Math.min(panelMaxHeight, preferredPanelHeight), panelMaxHeight };
}

export function PlaceEditorModal({
  visible,
  lat,
  lng,
  placeName,
  placeAddress,
  lists,
  existingPlace,
  existingPlaceListName,
  isInteractionLocked = false,
  onClose,
  onSave,
  onSaveError,
  onSaveStart,
  onDelete,
  onCreateList,
  draft,
  onMinimize,
}: PlaceEditorModalProps) {
  const animationType = useModalAnimationType('slide');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { banner } = useAppProgressBanner();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 20,
    bottomSpacing: 0,
    minTopPadding: 20,
    minBottomPadding: 0,
  });
  const {
    address,
    atmosphere,
    bestTimes,
    blockingNotice,
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
    menuUrl,
    name,
    newListCoverImage,
    newListDescription,
    newListName,
    newListPublic,
    notes,
    media,
    priceMax,
    priceMin,
    priceRangeIsValid,
    rating,
    selectedCategories,
    selectedLists,
    selectedMediaIndex,
    setAddress,
    setName,
    setMenuUrl,
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
  } = usePlaceEditorState({
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
  });
  const isEditorBusy = isSaving || isCreatingList || isInteractionLocked;
  const [previewMediaIndex, setPreviewMediaIndex] = React.useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const isCloseLocked = isCreatingList;
  // The modal overlay already reserves the bottom safe area. Reapplying the
  // navigation inset in the footer left a large empty block below the action.
  const footerPaddingBottom = 12;
  const isProgressBannerVisible = banner != null;
  const { panelHeight, panelMaxHeight } = getEditorPanelHeight({
    isProgressBannerVisible,
    paddingBottom,
    paddingTop,
    windowHeight,
  });
  const isDraftDirty = usePlaceEditorUnsavedChanges({
    buildDraft,
    existingPlace,
    lat,
    lists,
    lng,
    placeAddress,
    placeName,
    visible,
  });

  React.useEffect(() => {
    if (!visible || media.length === 0) {
      setPreviewMediaIndex(null);
      return;
    }

    setPreviewMediaIndex((current) => {
      if (current == null) {
        return null;
      }

      return current < media.length ? current : media.length - 1;
    });
  }, [media.length, visible]);

  React.useEffect(() => {
    if (!visible) {
      setShowDeleteConfirm(false);
      setShowDiscardConfirm(false);
    }
  }, [visible]);

  const handlePreviewMediaRemove = React.useCallback((index: number) => {
    handleRemoveMedia(index);
    setPreviewMediaIndex(media.length <= 1 ? null : Math.min(index, media.length - 2));
  }, [handleRemoveMedia, media.length]);

  const handleMinimizeEditor = React.useCallback(() => {
    if (!onMinimize) {
      return;
    }

    onMinimize(buildDraft());
  }, [buildDraft, onMinimize]);

  const handleDismissEditor = React.useCallback(() => {
    if (isCreatingList) {
      return;
    }

    if (isInteractionLocked && onMinimize) {
      handleMinimizeEditor();
      return;
    }

    if (isDraftDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    onClose();
  }, [handleMinimizeEditor, isCreatingList, isDraftDirty, isInteractionLocked, onClose, onMinimize]);

  const renderStep = () => {
    if (step === 0) {
      return (
        <PlaceEditorBasicsStep
          address={address}
          name={name}
          placeAddress={placeAddress}
          rating={rating}
          selectedCategories={selectedCategories}
          onAddressChange={setAddress}
          onNameChange={setName}
          onRatingChange={setRating}
          onToggleCategory={toggleCategory}
        />
      );
    }

    if (step === 1) {
      return (
        <PlaceEditorDetailsStep
          bestTimes={bestTimes}
          dietarySelections={dietarySelections}
          priceMax={priceMax}
          priceMin={priceMin}
          priceRangeIsValid={priceRangeIsValid}
          studentFriendly={studentFriendly}
          onPriceMaxChange={setPriceMax}
          onPriceMinChange={setPriceMin}
          onSetStudentFriendly={setStudentFriendly}
          onToggleBestTime={toggleBestTime}
          onToggleFeature={toggleFeature}
        />
      );
    }

    if (step === 2) {
      return (
        <PlaceEditorFinalStep
          atmosphere={atmosphere}
          currentMembershipListIds={currentMembershipListIds}
          duplicateListIds={duplicateListIds}
          features={features}
          generalFeatureOptions={generalFeatureOptions}
          isAddingMedia={isAddingMedia}
          isCreatingList={isCreatingList}
          isPickingListCover={isPickingListCover}
          listSelectionNotice={listSelectionNotice}
          lists={lists}
          newListCoverImage={newListCoverImage}
          newListDescription={newListDescription}
          newListName={newListName}
          newListPublic={newListPublic}
          media={media}
          menuUrl={menuUrl}
          notes={notes}
          selectedLists={selectedLists}
          selectedMediaIndex={selectedMediaIndex}
          showNewListForm={showNewListForm}
          title={title}
          onAddMedia={handleAddMedia}
          onCreateList={handleCreateList}
          onMediaPreview={(index) => setPreviewMediaIndex(index)}
          onMediaSelection={handleMediaPress}
          onMoveMedia={handleMoveMedia}
          onNewListCoverImageChange={setNewListCoverImage}
          onNewListDescriptionChange={setNewListDescription}
          onNewListNameChange={setNewListName}
          onNewListPublicChange={setNewListPublic}
          onMenuUrlChange={setMenuUrl}
          onNotesChange={setNotes}
          onPickListCover={handlePickListCover}
          onShowNewListFormChange={setShowNewListForm}
          onTitleChange={setTitle}
          onToggleAtmosphere={toggleAtmosphere}
          onToggleFeature={toggleFeature}
          onToggleList={toggleList}
        />
      );
    }

    return null;
  };

  const handleModalBack = () => {
    if (isCloseLocked) {
      return;
    }

    if (isInteractionLocked) {
      handleMinimizeEditor();
      return;
    }

    if (step > 0) {
      goToPreviousStep();
      return;
    }

    handleDismissEditor();
  };

  return (
    <AppModal
      animationType={animationType}
      onRequestClose={handleModalBack}
      visible={visible && (Platform.OS !== 'ios' || (!isAddingMedia && !isPickingListCover))}
    >
      <KeyboardAvoidingView
        accessibilityViewIsModal
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        importantForAccessibility="yes"
        onAccessibilityEscape={handleDismissEditor}
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <InstantPressable
          disableFeedback
          accessible={false}
          disabled={isCloseLocked}
          style={styles.backdrop}
          onPress={handleDismissEditor}
        />
        <View
          style={[
            styles.panel,
            isProgressBannerVisible ? styles.panelCompressed : null,
            { height: panelHeight, maxHeight: panelMaxHeight },
          ]}
        >
          <PlaceEditorModalHeader
            existingPlaceListName={existingPlaceListName}
            isEditing={Boolean(existingPlace)}
            isLocked={isCloseLocked}
            onClose={handleDismissEditor}
            onMinimize={onMinimize ? handleMinimizeEditor : undefined}
            subtitle={name || placeName || tr.placeEditor.minimizedNewTitle}
          />

          <PlaceEditorWizardHeader step={step} steps={wizardSteps} />

          <View style={styles.panelBody}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={[styles.content, styles.contentWithFooterBuffer]}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              scrollEnabled={!isInteractionLocked}
              showsVerticalScrollIndicator={false}
            >
              {renderStep()}
            </ScrollView>

            <PlaceEditorModalFooter
              canContinue={canContinue}
              isEditing={Boolean(existingPlace)}
              isBusy={isEditorBusy}
              isLastStep={step === wizardSteps.length - 1}
              onDelete={existingPlace && onDelete ? () => setShowDeleteConfirm(true) : undefined}
              onNext={goToNextStep}
              onPrevious={goToPreviousStep}
              onSave={handleSave}
              paddingBottom={footerPaddingBottom}
              step={step}
            />

            {isInteractionLocked ? (
              <View pointerEvents="auto" style={styles.lockOverlay}>
                <AppText style={styles.lockOverlayTitle}>{tr.placeEditor.saveProgressTitle}</AppText>
                <AppText style={styles.lockOverlayDescription}>{tr.placeEditor.saveLockedDescription}</AppText>
              </View>
            ) : null}
          </View>
        </View>
        {previewMediaIndex != null ? (
          <MediaLightbox
            allowDownload
            initialIndex={previewMediaIndex}
            items={media}
            onClose={() => setPreviewMediaIndex(null)}
            onRemoveItem={handlePreviewMediaRemove}
          />
        ) : null}
        {blockingNotice ? (
          <PlaceEditorTransientNotice
            description={blockingNotice.description}
            title={blockingNotice.title}
            onClose={clearBlockingNotice}
          />
        ) : null}
        {showDeleteConfirm && existingPlace && onDelete ? (
          <ConfirmActionModal
            visible
            title={tr.listDetail.deletePlaceTitle}
            description={tr.listDetail.deletePlaceDescription}
            confirmLabel={tr.common.delete}
            confirmVariant="danger"
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={() =>
              new Promise<void>((resolve, reject) => {
                dismissKeyboardAndRunAfterInteractions(() => {
                  try {
                    return Promise.resolve(onDelete(existingPlace.id)).then(resolve, reject);
                  } catch (error) {
                    reject(error);
                  }
                });
              })
            }
          />
        ) : null}
        {showDiscardConfirm ? (
          <ConfirmActionModal
            visible
            title={DISCARD_PLACE_EDITOR_CONFIRMATION.title}
            description={DISCARD_PLACE_EDITOR_CONFIRMATION.description}
            cancelLabel={DISCARD_PLACE_EDITOR_CONFIRMATION.cancelLabel}
            confirmLabel={DISCARD_PLACE_EDITOR_CONFIRMATION.confirmLabel}
            confirmVariant="danger"
            onClose={() => setShowDiscardConfirm(false)}
            onConfirm={() => {
              setShowDiscardConfirm(false);
              dismissKeyboardAndRunAfterInteractions(onClose);
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </AppModal>
  );
}
