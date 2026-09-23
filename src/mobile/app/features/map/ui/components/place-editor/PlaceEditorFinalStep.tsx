import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  iconSize,
  opacity,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';
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
  onMoveMedia: (fromIndex: number, toIndex: number) => void;
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
  count,
  index,
  isSelected,
  item,
  onMoveEarlier,
  onMoveLater,
  onPress,
  onLongPress,
}: {
  count: number;
  index: number;
  isSelected: boolean;
  item: PlaceMedia;
  onMoveEarlier?: () => void;
  onMoveLater?: () => void;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const ignoreNextPressRef = React.useRef(false);

  return (
    <InstantPressable
      accessibilityActions={[
        ...(onMoveEarlier
          ? [{ name: 'decrement' as const, label: tr.placeEditor.mediaMoveEarlier }]
          : []),
        ...(onMoveLater
          ? [{ name: 'increment' as const, label: tr.placeEditor.mediaMoveLater }]
          : []),
      ]}
      accessibilityLabel={tr.placeEditor.mediaItemLabel(
        index + 1,
        count,
        item.type === 'video' ? tr.common.mediaVideo : tr.common.mediaPhoto,
      )}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      delayLongPress={500}
      onLongPress={() => {
        ignoreNextPressRef.current = true;
        onLongPress();
      }}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'decrement') {
          onMoveEarlier?.();
        } else if (event.nativeEvent.actionName === 'increment') {
          onMoveLater?.();
        }
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
        <View pointerEvents="none" style={styles.mediaOrderBadge}>
          <Badge label={String(index + 1)} numeric tone="overlay" />
        </View>
      </View>
    </InstantPressable>
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
  onMoveMedia,
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

      <TextField
        label={`${tr.placeEditor.shortTitleLabel} (${tr.common.optional})`}
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
        label={`${tr.placeEditor.menuUrlLabel} (${tr.common.optional})`}
        helper={tr.placeEditor.menuUrlHelper}
        maxLength={PLACE_MENU_URL_MAX_LENGTH}
        placeholder={tr.placeEditor.menuUrlPlaceholder}
        value={menuUrl}
        onChangeText={onMenuUrlChange}
      />
      <TextField
        label={`${tr.placeEditor.notesLabel} (${tr.common.optional})`}
        value={notes}
        onChangeText={onNotesChange}
        multilineRows={4}
        placeholder={tr.placeEditor.notesPlaceholder}
        maxLength={PLACE_NOTES_MAX_LENGTH}
      />

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{`${tr.placeEditor.atmosphere} (${tr.common.optional})`}</AppText>
        <AppText style={styles.sectionHelper}>{tr.placeEditor.atmosphereHelper}</AppText>
        <OptionRail options={PLACE_ATMOSPHERE_OPTIONS} selectedValues={atmosphere} onToggle={onToggleAtmosphere} />
        {atmosphere.length > 0 ? (
          <AppText style={styles.selectionMeta}>{tr.placeEditor.selectionCount(atmosphere.length, 'atmosfer')}</AppText>
        ) : null}
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{`${tr.placeEditor.features} (${tr.common.optional})`}</AppText>
        <AppText style={styles.sectionHelper}>{tr.placeEditor.featuresHelper}</AppText>
        <OptionRail options={generalFeatureOptions} selectedValues={features} onToggle={onToggleFeature} />
        {features.length > 0 ? (
          <AppText style={styles.selectionMeta}>{tr.placeEditor.selectionCount(features.length, 'özellik')}</AppText>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.mediaSectionHeader}>
          <View style={styles.mediaSectionHeaderCopy}>
            <AppText style={styles.sectionTitle}>{`${tr.placeEditor.mediaTitle} (${tr.common.optional})`}</AppText>
            {mediaHelperText ? (
              <AppText style={[styles.sectionHelper, styles.sectionHelperActive]}>
                {mediaHelperText}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.counterRow}>
          <Badge label={photoCounterLabel} numeric tone="primary" />
          <Badge label={videoCounterLabel} numeric tone="primary" />
          <Badge label={mediaCounterLabel} numeric />
        </View>

        {media.length === 0 ? (
          <InstantPressable
            accessibilityRole="button"
            style={[styles.mediaEmptyCard, isAddingMedia ? styles.mediaBusy : null]}
            onPress={() => {
              void onAddMedia();
            }}
            disabled={isAddingMedia}
          >
            <View style={styles.mediaEmptyIconWrap}>
              <Camera color={colors.primary} size={iconSize.md} />
            </View>
            <View style={styles.mediaEmptyCopy}>
              <AppText style={styles.mediaEmptyTitle}>{tr.placeEditor.mediaEmptyTitle}</AppText>
              <AppText style={styles.mediaEmptyText}>
                {tr.placeEditor.mediaEmptyDescription}
              </AppText>
            </View>
            <View style={styles.mediaEmptyAction}>
              <ImagePlus color={colors.primary} size={iconSize.sm} />
              <AppText style={styles.mediaEmptyActionText}>
                {isAddingMedia ? tr.placeEditor.photoAddInProgress : tr.placeEditor.mediaAddAction}
              </AppText>
            </View>
          </InstantPressable>
        ) : (
          <View style={styles.mediaRail}>
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaStrip}
            >
              {media.map((item, index) => (
                <MediaThumb
                  count={media.length}
                  key={`${item.id ?? item.url}-${item.type}`}
                  index={index}
                  isSelected={selectedMediaIndex === index}
                  item={item}
                  onMoveEarlier={index > 0 ? () => onMoveMedia(index, index - 1) : undefined}
                  onMoveLater={
                    index < media.length - 1 ? () => onMoveMedia(index, index + 1) : undefined
                  }
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
                <InstantPressable
                  accessibilityRole="button"
                  style={[styles.mediaAddTile, isAddingMedia ? styles.mediaBusy : null]}
                  onPress={() => {
                    void onAddMedia();
                  }}
                  disabled={isAddingMedia}
                >
                  <View style={styles.mediaAddIconWrap}>
                    <ImagePlus color={colors.primary} size={iconSize.sm} />
                  </View>
                  <AppText style={styles.addMediaText}>
                    {isAddingMedia ? tr.placeEditor.photoAddInProgress : tr.placeEditor.add}
                  </AppText>
                  <AppText style={styles.addMediaSubtext}>{tr.placeEditor.mediaAddTileSubtitle}</AppText>
                </InstantPressable>
              ) : null}
            </ScrollView>
          </View>
        )}

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: textStyle('metadataText', colors.text, fontWeight.strong),
  sectionHelper: {
    marginTop: -2,
    ...typography.metadataText,
    color: colors.textSoft,
  },
  sectionHelperActive: {
    color: colors.primary,
  },
  selectionMeta: textStyle('metadataText', colors.primary, fontWeight.strong),
  mediaSectionHeader: {
    gap: spacing.sm,
  },
  mediaSectionHeaderCopy: {
    gap: spacing.xxs,
  },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mediaEmptyCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  mediaBusy: {
    opacity: opacity.disabled,
  },
  mediaEmptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  mediaEmptyCopy: {
    gap: spacing.xs,
  },
  mediaEmptyTitle: textStyle('bodyText', colors.text, fontWeight.strong),
  mediaEmptyText: textStyle('metadataText', colors.textMuted, fontWeight.regular),
  mediaEmptyAction: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mediaEmptyActionText: textStyle('metadataText', colors.primary, fontWeight.strong),
  mediaRail: {
    width: '100%',
  },
  mediaStrip: {
    gap: spacing.sm,
  },
  mediaThumbShell: {
    width: 80,
    height: 80,
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
    top: spacing.sm,
    left: spacing.sm,
  },
  mediaAddTile: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  mediaAddIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addMediaText: textStyle('metadataText', colors.primary, fontWeight.strong),
  addMediaSubtext: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textSoft,
    textAlign: 'center',
  },
});
