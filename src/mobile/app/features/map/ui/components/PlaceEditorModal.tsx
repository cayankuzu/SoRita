import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppProgressBanner } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import { usePlaceEditorState } from '@/mobile/app/features/map/application/usePlaceEditorState';
import { PlaceEditorBasicsStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorBasicsStep';
import { PlaceEditorDetailsStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorDetailsStep';
import { PlaceEditorFinalStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorFinalStep';
import { PlaceEditorModalFooter } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalFooter';
import { PlaceEditorModalHeader } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalHeader';
import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { PlaceEditorWizardHeader } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorWizardHeader';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getModalSafeAreaPadding } from '@/mobile/app/shared/utils/modalLayout';

export type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';

type PlaceEditorModalProps = {
  visible: boolean;
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
  lists: PlaceList[];
  existingPlace?: Place | null;
  existingPlaceListName?: string;
  onClose: () => void;
  onSave: (
    place: Omit<Place, 'id' | 'addedAt'>,
    targetListIds: string[],
    options?: { onProgress?: (progress: number) => void },
  ) => Promise<void> | void;
  onDelete?: (placeId: string) => void;
  onCreateList?: (list: PlaceList) => Promise<void> | void;
  draft?: PlaceEditorDraft | null;
  onMinimize?: (draft: PlaceEditorDraft) => void;
};

const wizardSteps = tr.placeEditor.steps;

export function PlaceEditorModal({
  visible,
  lat,
  lng,
  placeName,
  placeAddress,
  lists,
  existingPlace,
  existingPlaceListName,
  onClose,
  onSave,
  onDelete,
  onCreateList,
  draft,
  onMinimize,
}: PlaceEditorModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { progress } = useAppProgressBanner();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 20,
    bottomSpacing: 12,
    minTopPadding: Platform.OS === 'android' ? 20 : 20,
    minBottomPadding: Platform.OS === 'android' ? 36 : 12,
  });
  const {
    address,
    atmosphere,
    bestTimes,
    buildDraft,
    canContinue,
    currentMembershipListIds,
    dietarySelections,
    duplicateListIds,
    features,
    generalFeatureOptions,
    goToNextStep,
    goToPreviousStep,
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
    name,
    newListCoverImage,
    newListDescription,
    newListName,
    newListPublic,
    notes,
    media,
    priceMax,
    priceMin,
    rating,
    selectedCategories,
    selectedLists,
    selectedMediaIndex,
    setAddress,
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
    onSaveStart: onClose,
    onCreateList,
  });
  const isEditorBusy = isSaving || isCreatingList;
  const isCloseLocked = isCreatingList;
  const footerPaddingBottom = Platform.OS === 'android' ? 26 : 18;
  const isProgressBannerVisible = progress != null;
  const progressBannerReserve = isProgressBannerVisible
    ? Platform.OS === 'android'
      ? 212
      : 176
    : 0;
  const compressedPanelMaxHeight = isProgressBannerVisible
    ? Math.max(windowHeight - paddingTop - paddingBottom - progressBannerReserve, 360)
    : null;

  const renderStep = () => {
    if (step === 0) {
      return (
        <PlaceEditorBasicsStep
          address={address}
          existingPlaceListName={existingPlaceListName}
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
          notes={notes}
          selectedLists={selectedLists}
          selectedMediaIndex={selectedMediaIndex}
          showNewListForm={showNewListForm}
          title={title}
          onAddMedia={handleAddMedia}
          onCreateList={handleCreateList}
          onMediaPress={handleMediaPress}
          onNewListCoverImageChange={setNewListCoverImage}
          onNewListDescriptionChange={setNewListDescription}
          onNewListNameChange={setNewListName}
          onNewListPublicChange={setNewListPublic}
          onNotesChange={setNotes}
          onPickListCover={handlePickListCover}
          onRemoveMedia={handleRemoveMedia}
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={isCloseLocked ? undefined : onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <Pressable disabled={isCloseLocked} style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.panel,
            isProgressBannerVisible ? styles.panelCompressed : null,
            compressedPanelMaxHeight != null ? { maxHeight: compressedPanelMaxHeight } : null,
          ]}
        >
          <PlaceEditorModalHeader
            existingPlaceListName={existingPlaceListName}
            isEditing={Boolean(existingPlace)}
            onClose={isCloseLocked ? () => undefined : onClose}
            onMinimize={
              onMinimize && !isCloseLocked ? () => onMinimize(buildDraft()) : undefined
            }
            subtitle={name || placeName || tr.placeEditor.minimizedNewTitle}
          />

          <PlaceEditorWizardHeader step={step} steps={wizardSteps} />

          <ScrollView
            contentContainerStyle={[styles.content, styles.contentWithFooterBuffer]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {renderStep()}
          </ScrollView>

          <PlaceEditorModalFooter
            canContinue={canContinue}
            isEditing={Boolean(existingPlace)}
            isBusy={isEditorBusy}
            isLastStep={step === wizardSteps.length - 1}
            onDelete={existingPlace && onDelete ? () => onDelete(existingPlace.id) : undefined}
            onNext={goToNextStep}
            onPrevious={goToPreviousStep}
            onSave={handleSave}
            paddingBottom={footerPaddingBottom}
            step={step}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
