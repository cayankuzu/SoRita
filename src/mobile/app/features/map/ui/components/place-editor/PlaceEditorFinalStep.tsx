import React from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { ImagePlus, Trash2 } from 'lucide-react-native';

import { PLACE_ATMOSPHERE_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { MAX_PLACE_PHOTOS, PLACE_EDITOR_COPY } from '@/mobile/app/features/map/catalog/placeEditor';
import { OptionRail } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls';
import { PlaceEditorListSelectionSection } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorListSelectionSection';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import {
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type PlaceEditorFinalStepProps = {
  atmosphere: string[];
  currentMembershipListIds: Set<string>;
  draggingPhotoIndex: number | null;
  duplicateListIds: Set<string>;
  features: string[];
  generalFeatureOptions: string[];
  isAddingPhoto: boolean;
  isCreatingList: boolean;
  isPickingListCover: boolean;
  listSelectionNotice?: string | null;
  lists: PlaceList[];
  newListCoverImage: string;
  newListDescription: string;
  newListName: string;
  newListPublic: boolean;
  notes: string;
  photoDragX: Animated.Value;
  photos: string[];
  selectedLists: string[];
  showNewListForm: boolean;
  title: string;
  onAddPhoto: () => void | Promise<void>;
  onCreateList: () => void | Promise<void>;
  onNewListCoverImageChange: (value: string) => void;
  onNewListDescriptionChange: (value: string) => void;
  onNewListNameChange: (value: string) => void;
  onNewListPublicChange: (value: boolean) => void;
  onNotesChange: (value: string) => void;
  onPhotoLongPress: (index: number) => void;
  onPhotoTouchEnd: (index: number, event?: GestureResponderEvent) => void;
  onPhotoTouchMove: (index: number, event: GestureResponderEvent) => void;
  onPhotoTouchStart: (index: number, event: GestureResponderEvent) => void;
  onPickListCover: () => void | Promise<void>;
  onRemovePhoto: (index: number) => void;
  onShowNewListFormChange: (value: boolean) => void;
  onTitleChange: (value: string) => void;
  onToggleAtmosphere: (value: string) => void;
  onToggleFeature: (value: string) => void;
  onToggleList: (listId: string, options?: { blocked?: boolean; listName?: string }) => void;
};

export function PlaceEditorFinalStep({
  atmosphere,
  currentMembershipListIds,
  draggingPhotoIndex,
  duplicateListIds,
  features,
  generalFeatureOptions,
  isAddingPhoto,
  isCreatingList,
  isPickingListCover,
  listSelectionNotice,
  lists,
  newListCoverImage,
  newListDescription,
  newListName,
  newListPublic,
  notes,
  photoDragX,
  photos,
  selectedLists,
  showNewListForm,
  title,
  onAddPhoto,
  onCreateList,
  onNewListCoverImageChange,
  onNewListDescriptionChange,
  onNewListNameChange,
  onNewListPublicChange,
  onNotesChange,
  onPhotoLongPress,
  onPhotoTouchEnd,
  onPhotoTouchMove,
  onPhotoTouchStart,
  onPickListCover,
  onRemovePhoto,
  onShowNewListFormChange,
  onTitleChange,
  onToggleAtmosphere,
  onToggleFeature,
  onToggleList,
}: PlaceEditorFinalStepProps) {
  return (
    <View style={styles.stepContent}>
      <TextField
        label={tr.placeEditor.shortTitleLabel}
        value={title}
        onChangeText={onTitleChange}
        placeholder={tr.placeEditor.shortTitlePlaceholder}
        maxLength={PLACE_TITLE_MAX_LENGTH}
      />
      <TextField
        label={tr.placeEditor.notesLabel}
        value={notes}
        onChangeText={onNotesChange}
        multilineRows={4}
        placeholder={tr.placeEditor.notesPlaceholder}
        maxLength={PLACE_NOTES_MAX_LENGTH}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.atmosphere}</Text>
        <Text style={styles.sectionHelper}>Birden fazla atmosfer sec</Text>
        <OptionRail options={PLACE_ATMOSPHERE_OPTIONS} selectedValues={atmosphere} onToggle={onToggleAtmosphere} />
        {atmosphere.length > 0 ? <Text style={styles.selectionMeta}>{atmosphere.length} atmosfer secildi</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.features}</Text>
        <Text style={styles.sectionHelper}>Kaydirarak uygun ozellikleri sec</Text>
        <OptionRail options={generalFeatureOptions} selectedValues={features} onToggle={onToggleFeature} />
        {features.length > 0 ? <Text style={styles.selectionMeta}>{features.length} ozellik secildi</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.photos}</Text>
        <Text style={styles.sectionHelper}>
          {PLACE_EDITOR_COPY.photoCounterLabel(photos.length, MAX_PLACE_PHOTOS)}. Fotografa uzun basip saga sola surukleyerek siralamayi degistir.
        </Text>
        <View style={styles.photoRail}>
          <ScrollView
            horizontal
            scrollEnabled={draggingPhotoIndex == null}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {photos.map((uri, index) => {
              const isDragging = draggingPhotoIndex === index;

              return (
                <Pressable
                  key={`${uri}-${index}`}
                  delayLongPress={180}
                  onPressIn={(event) => onPhotoTouchStart(index, event)}
                  onLongPress={() => onPhotoLongPress(index)}
                  onTouchMove={(event) => onPhotoTouchMove(index, event)}
                  onTouchEnd={(event) => onPhotoTouchEnd(index, event)}
                  onTouchCancel={() => onPhotoTouchEnd(index)}
                >
                  <Animated.View
                    style={[
                      styles.photoThumb,
                      isDragging ? styles.photoThumbDragging : null,
                      isDragging ? { transform: [{ translateX: photoDragX }, { scale: 1.04 }] } : null,
                    ]}
                  >
                    <Image source={{ uri }} style={StyleSheet.absoluteFillObject} />
                    <Pressable disabled={isDragging} onPress={() => onRemovePhoto(index)} style={styles.photoRemove}>
                      <Trash2 color={colors.onPrimary} size={14} />
                    </Pressable>
                    <View style={styles.photoOrder}>
                      <Text style={styles.photoOrderText}>{index + 1}</Text>
                    </View>
                  </Animated.View>
                </Pressable>
              );
            })}
            {photos.length < MAX_PLACE_PHOTOS ? (
              <Pressable
                style={[styles.photoAddTile, isAddingPhoto ? styles.photoAddTileBusy : null]}
                onPress={() => {
                  void onAddPhoto();
                }}
                disabled={isAddingPhoto}
              >
                <ImagePlus color={colors.primary} size={20} />
                <Text style={styles.addPhotoText}>
                  {isAddingPhoto ? 'Ekleniyor' : tr.placeEditor.add}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <PlaceEditorListSelectionSection
        currentMembershipListIds={currentMembershipListIds}
        duplicateListIds={duplicateListIds}
        isCreatingList={isCreatingList}
        isPickingListCover={isPickingListCover}
        listSelectionNotice={listSelectionNotice}
        lists={lists}
        newListCoverImage={newListCoverImage}
        newListDescription={newListDescription}
        newListName={newListName}
        newListPublic={newListPublic}
        selectedLists={selectedLists}
        showNewListForm={showNewListForm}
        onCreateList={onCreateList}
        onNewListCoverImageChange={onNewListCoverImageChange}
        onNewListDescriptionChange={onNewListDescriptionChange}
        onNewListNameChange={onNewListNameChange}
        onNewListPublicChange={onNewListPublicChange}
        onPickListCover={onPickListCover}
        onShowNewListFormChange={onShowNewListFormChange}
        onToggleList={onToggleList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    gap: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  sectionHelper: {
    marginTop: -2,
    fontSize: 11,
    color: colors.textSoft,
  },
  selectionMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  photoStrip: {
    gap: 10,
  },
  photoRail: {
    width: '100%',
  },
  photoThumb: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  photoThumbDragging: {
    borderWidth: 2,
    borderColor: colors.primary,
    zIndex: 3,
    elevation: 3,
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  photoOrder: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  photoOrderText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  photoAddTile: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoAddTileBusy: {
    opacity: 0.6,
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
});
