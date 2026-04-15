import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import { usePlaceEditorState } from '@/mobile/app/features/map/application/usePlaceEditorState';
import { PlaceEditorBasicsStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorBasicsStep';
import { PlaceEditorDetailsStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorDetailsStep';
import { PlaceEditorFinalStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorFinalStep';
import { PlaceEditorModalFooter } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalFooter';
import { PlaceEditorModalHeader } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalHeader';
import { PlaceEditorPreviewStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorPreviewStep';
import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { PlaceEditorWizardHeader } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorWizardHeader';
import { tr } from '@/mobile/app/shared/i18n/tr';

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
  onSave: (place: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => Promise<void> | void;
  onDelete?: (placeId: string) => void;
  onCreateList?: (list: PlaceList) => Promise<void> | void;
  draft?: PlaceEditorDraft | null;
  onMinimize?: (draft: PlaceEditorDraft) => void;
};

const wizardSteps = [
  ...tr.placeEditor.steps,
  {
    title: tr.common.preview,
    subtitle: 'Kartinin nasil gorunecegini kontrol et',
  },
] as const;

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
  const {
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
    onCreateList,
  });

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
          draggingPhotoIndex={draggingPhotoIndex}
          duplicateListIds={duplicateListIds}
          features={features}
          generalFeatureOptions={generalFeatureOptions}
          listSelectionNotice={listSelectionNotice}
          lists={lists}
          newListCoverImage={newListCoverImage}
          newListDescription={newListDescription}
          newListName={newListName}
          newListPublic={newListPublic}
          notes={notes}
          photoDragX={photoDragX}
          photos={photos}
          selectedLists={selectedLists}
          showNewListForm={showNewListForm}
          title={title}
          onAddPhoto={handleAddPhoto}
          onCreateList={handleCreateList}
          onNewListCoverImageChange={setNewListCoverImage}
          onNewListDescriptionChange={setNewListDescription}
          onNewListNameChange={setNewListName}
          onNewListPublicChange={setNewListPublic}
          onNotesChange={setNotes}
          onPhotoLongPress={handlePhotoLongPress}
          onPhotoTouchEnd={handlePhotoTouchEnd}
          onPhotoTouchMove={handlePhotoTouchMove}
          onPhotoTouchStart={handlePhotoTouchStart}
          onPickListCover={handlePickListCover}
          onRemovePhoto={handleRemovePhoto}
          onShowNewListFormChange={setShowNewListForm}
          onTitleChange={setTitle}
          onToggleAtmosphere={toggleAtmosphere}
          onToggleFeature={toggleFeature}
          onToggleList={toggleList}
        />
      );
    }

    return (
      <PlaceEditorPreviewStep
        previewBestTimes={previewBestTimes}
        previewCategories={previewCategories}
        previewDietaryOptions={previewDietaryOptions}
        previewGeneralFeatures={previewGeneralFeatures}
        previewPlace={previewPlace}
        previewPriceLabel={previewPriceLabel}
        selectedListCount={selectedLists.length}
        selectedPreviewList={selectedPreviewList}
      />
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <PlaceEditorModalHeader
            existingPlaceListName={existingPlaceListName}
            isEditing={Boolean(existingPlace)}
            onClose={onClose}
            onMinimize={onMinimize ? () => onMinimize(buildDraft()) : undefined}
            subtitle={name || placeName || tr.placeEditor.minimizedNewTitle}
          />

          <PlaceEditorWizardHeader step={step} steps={wizardSteps} />

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {renderStep()}
          </ScrollView>

          <PlaceEditorModalFooter
            canContinue={canContinue}
            isEditing={Boolean(existingPlace)}
            isLastStep={step === wizardSteps.length - 1}
            onDelete={existingPlace && onDelete ? () => onDelete(existingPlace.id) : undefined}
            onNext={goToNextStep}
            onPrevious={goToPreviousStep}
            onSave={handleSave}
            paddingBottom={16 + insets.bottom}
            step={step}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
