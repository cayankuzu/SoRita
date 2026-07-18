import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  ImagePlus,
} from 'lucide-react-native';

import { PLACE_ATMOSPHERE_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import type { PlaceList, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import {
  MAX_PLACE_MEDIA_ITEMS,
  MAX_PLACE_PHOTOS,
  MAX_PLACE_VIDEOS,
  PLACE_EDITOR_COPY,
} from '@/mobile/app/features/map/catalog/placeEditor';
import { OptionRail } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls';
import { PlaceEditorListSelectionSection } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorListSelectionSection';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import {
  formatPlaceMediaDuration,
  getPlaceMediaCounts,
} from '@/mobile/app/shared/utils/placeMedia';
import {
  PLACE_MENU_URL_MAX_LENGTH,
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type PlaceEditorFinalStepProps = {
  atmosphere: string[];
  currentMembershipListIds: Set<string>;
  duplicateListIds: Set<string>;
  features: string[];
  generalFeatureOptions: string[];
  isAddingMedia: boolean;
  isCreatingList: boolean;
  isPickingListCover: boolean;
  listSelectionNotice?: string | null;
  lists: PlaceList[];
  media: PlaceMedia[];
  menuUrl: string;
  newListCoverImage: string;
  newListDescription: string;
  newListName: string;
  newListPublic: boolean;
  notes: string;
  selectedLists: string[];
  selectedMediaIndex: number | null;
  showNewListForm: boolean;
  title: string;
  onAddMedia: () => void | Promise<void>;
  onCreateList: () => void | Promise<void>;
  onMediaPreview: (index: number) => void;
  onMediaSelection: (index: number) => void;
  onNewListCoverImageChange: (value: string) => void;
  onNewListDescriptionChange: (value: string) => void;
  onNewListNameChange: (value: string) => void;
  onNewListPublicChange: (value: boolean) => void;
  onMenuUrlChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPickListCover: () => void | Promise<void>;
  onShowNewListFormChange: (value: boolean) => void;
  onTitleChange: (value: string) => void;
  onToggleAtmosphere: (value: string) => void;
  onToggleFeature: (value: string) => void;
  onToggleList: (listId: string, options?: { blocked?: boolean; listName?: string }) => void;
};

function MediaThumb({
  index,
  isSelected,
  item,
  onPress,
  onLongPress,
}: {
  index: number;
  isSelected: boolean;
  item: PlaceMedia;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const ignoreNextPressRef = React.useRef(false);

  return (
    <Pressable
      delayLongPress={500}
      onLongPress={() => {
        ignoreNextPressRef.current = true;
        onLongPress();
      }}
      onPress={() => {
        if (ignoreNextPressRef.current) {
          ignoreNextPressRef.current = false;
          return;
        }

        onPress();
      }}
    >
      <View style={[styles.mediaThumbShell, isSelected ? styles.mediaThumbShellSelected : null]}>
        <View style={styles.mediaThumb}>
          <MediaThumbnailView
            backgroundColor="transparent"
            key={`${item.url}:${item.thumbnailUrl ?? 'no-thumb'}:${isSelected ? 'selected' : 'idle'}`}
            item={item}
            durationLabel={formatPlaceMediaDuration(item.durationMs)}
            fallbackToVideoPreview={false}
            style={styles.mediaThumbPreview}
          />
        </View>
        <View style={styles.mediaOrderBadge}>
          <Text style={styles.mediaOrderBadgeText}>{index + 1}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function PlaceEditorFinalStep({
  atmosphere,
  currentMembershipListIds,
  duplicateListIds,
  features,
  generalFeatureOptions,
  isAddingMedia,
  isCreatingList,
  isPickingListCover,
  listSelectionNotice,
  lists,
  media,
  menuUrl,
  newListCoverImage,
  newListDescription,
  newListName,
  newListPublic,
  notes,
  selectedLists,
  selectedMediaIndex,
  showNewListForm,
  title,
  onAddMedia,
  onCreateList,
  onMediaPreview,
  onMediaSelection,
  onNewListCoverImageChange,
  onNewListDescriptionChange,
  onNewListNameChange,
  onNewListPublicChange,
  onMenuUrlChange,
  onNotesChange,
  onPickListCover,
  onShowNewListFormChange,
  onTitleChange,
  onToggleAtmosphere,
  onToggleFeature,
  onToggleList,
}: PlaceEditorFinalStepProps) {
  const mediaCounts = getPlaceMediaCounts(media);
  const photoCounterLabel = PLACE_EDITOR_COPY.photoCounterLabel(mediaCounts.photos, MAX_PLACE_PHOTOS);
  const videoCounterLabel = PLACE_EDITOR_COPY.videoCounterLabel(mediaCounts.videos, MAX_PLACE_VIDEOS);
  const mediaCounterLabel = PLACE_EDITOR_COPY.mediaCounterLabel(mediaCounts.total, MAX_PLACE_MEDIA_ITEMS);
  const mediaHelperText =
    media.length > 0
      ? selectedMediaIndex == null
        ? tr.placeEditor.mediaReorderHint
        : tr.placeEditor.mediaSwapHint
      : null;

  return (
    <View style={styles.stepContent}>
      <TextField
        label={tr.placeEditor.shortTitleLabel}
        value={title}
        onChangeText={onTitleChange}
        multilineRows={3}
        placeholder={tr.placeEditor.shortTitlePlaceholder}
        maxLength={PLACE_TITLE_MAX_LENGTH}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="url"
        autoCorrect={false}
        keyboardType="url"
        label={tr.placeEditor.menuUrlLabel}
        helper={tr.placeEditor.menuUrlHelper}
        maxLength={PLACE_MENU_URL_MAX_LENGTH}
        placeholder={tr.placeEditor.menuUrlPlaceholder}
        value={menuUrl}
        onChangeText={onMenuUrlChange}
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
        <Text style={styles.sectionHelper}>{tr.placeEditor.atmosphereHelper}</Text>
        <OptionRail options={PLACE_ATMOSPHERE_OPTIONS} selectedValues={atmosphere} onToggle={onToggleAtmosphere} />
        {atmosphere.length > 0 ? (
          <Text style={styles.selectionMeta}>{tr.placeEditor.selectionCount(atmosphere.length, 'atmosfer')}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.features}</Text>
        <Text style={styles.sectionHelper}>{tr.placeEditor.featuresHelper}</Text>
        <OptionRail options={generalFeatureOptions} selectedValues={features} onToggle={onToggleFeature} />
        {features.length > 0 ? (
          <Text style={styles.selectionMeta}>{tr.placeEditor.selectionCount(features.length, 'özellik')}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.mediaSectionHeader}>
          <View style={styles.mediaSectionHeaderCopy}>
            <Text style={styles.sectionTitle}>{tr.placeEditor.mediaTitle}</Text>
            {mediaHelperText ? (
              <Text style={[styles.sectionHelper, styles.sectionHelperActive]}>
                {mediaHelperText}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.counterRow}>
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>{photoCounterLabel}</Text>
          </View>
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>{videoCounterLabel}</Text>
          </View>
          <View style={styles.counterBadgeStrong}>
            <Text style={styles.counterBadgeStrongText}>{mediaCounterLabel}</Text>
          </View>
        </View>

        {media.length === 0 ? (
          <Pressable
            style={[styles.mediaEmptyCard, isAddingMedia ? styles.mediaBusy : null]}
            onPress={() => {
              void onAddMedia();
            }}
            disabled={isAddingMedia}
          >
            <View style={styles.mediaEmptyIconWrap}>
              <Camera color={colors.primary} size={20} />
            </View>
            <View style={styles.mediaEmptyCopy}>
              <Text style={styles.mediaEmptyTitle}>{tr.placeEditor.mediaEmptyTitle}</Text>
              <Text style={styles.mediaEmptyText}>
                {tr.placeEditor.mediaEmptyDescription}
              </Text>
            </View>
            <View style={styles.mediaEmptyAction}>
              <ImagePlus color={colors.primary} size={18} />
              <Text style={styles.mediaEmptyActionText}>
                {isAddingMedia ? tr.placeEditor.photoAddInProgress : tr.placeEditor.mediaAddAction}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.mediaRail}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaStrip}
            >
              {media.map((item, index) => (
                <MediaThumb
                  key={`${item.id ?? item.url}-${item.type}`}
                  index={index}
                  isSelected={selectedMediaIndex === index}
                  item={item}
                  onLongPress={() => onMediaSelection(index)}
                  onPress={() => {
                    if (selectedMediaIndex == null) {
                      onMediaPreview(index);
                      return;
                    }

                    onMediaSelection(index);
                  }}
                />
              ))}

              {mediaCounts.total < MAX_PLACE_MEDIA_ITEMS ? (
                <Pressable
                  style={[styles.mediaAddTile, isAddingMedia ? styles.mediaBusy : null]}
                  onPress={() => {
                    void onAddMedia();
                  }}
                  disabled={isAddingMedia}
                >
                  <View style={styles.mediaAddIconWrap}>
                    <ImagePlus color={colors.primary} size={18} />
                  </View>
                  <Text style={styles.addMediaText}>
                    {isAddingMedia ? tr.placeEditor.photoAddInProgress : tr.placeEditor.add}
                  </Text>
                  <Text style={styles.addMediaSubtext}>{tr.placeEditor.mediaAddTileSubtitle}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        )}

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
    lineHeight: 17,
    color: colors.textSoft,
  },
  sectionHelperActive: {
    color: colors.primary,
  },
  selectionMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  mediaSectionHeader: {
    gap: 10,
  },
  mediaSectionHeaderCopy: {
    gap: 2,
  },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  counterBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  counterBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  counterBadgeStrong: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  counterBadgeStrongText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  mediaEmptyCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
  },
  mediaBusy: {
    opacity: 0.65,
  },
  mediaEmptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  mediaEmptyCopy: {
    gap: 6,
  },
  mediaEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  mediaEmptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  mediaEmptyAction: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    backgroundColor: colors.primaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaEmptyActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  mediaRail: {
    width: '100%',
  },
  mediaStrip: {
    gap: 10,
  },
  mediaThumbShell: {
    width: 94,
    height: 94,
    borderRadius: radius.md + 2,
    padding: 2.5,
    backgroundColor: 'transparent',
  },
  mediaThumbShellSelected: {
    backgroundColor: colors.primary,
  },
  mediaThumb: {
    flex: 1,
    borderRadius: radius.md - 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  mediaThumbPreview: {
    width: '100%',
    height: '100%',
  },
  mediaOrderBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 6,
  },
  mediaOrderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  mediaAddTile: {
    width: 94,
    height: 94,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaAddIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addMediaText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  addMediaSubtext: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSoft,
    textAlign: 'center',
  },
});
