import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Camera,
  ChevronRight,
  Crosshair,
  Ellipsis,
  Globe,
  List as ListIcon,
  Lock,
  PlayCircle,
  Star,
} from 'lucide-react-native';

import type { Place, User } from '@/mobile/app/data/contracts/entities';
import { OwnerHeader } from '@/mobile/app/features/discovery/ui/components/OwnerHeader';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import type { ActionMenuSheetItem } from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { DeferredActionMenuSheet } from '@/mobile/app/shared/components/feedback/DeferredActionMenuSheet';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import {
  MINI_MAP_RESET_LONG_PRESS_MS,
  useMiniMapInteraction,
} from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { HighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { getListMarkerColor } from '@/mobile/app/shared/utils/markerColors';
import { getResponsiveDiscoveryTileWidth } from '@/mobile/app/shared/utils/layout';
import {
  getPlaceMedia,
  getPlaceMediaCounts,
} from '@/mobile/app/shared/utils/placeMedia';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

export type PlaceGridTileProps = {
  place: Place;
  owner?: User | null;
  fillWidth?: boolean;
  showOwner?: boolean;
  mode?: 'place' | 'photo';
  listCoverImage?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listName?: string;
  markerColor?: string;
  compact?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onOwnerPress?: () => void;
  onOwnerPressIn?: () => void;
  menuActions?: ActionMenuSheetItem[];
  searchQuery?: string;
};

function getPlaceGridTileModel(
  place: Place,
  mode: 'place' | 'photo',
  listIsPublic?: boolean,
  listName?: string,
) {
  const media = getPlaceMedia(place);
  const primaryMedia = media[0];
  const hasMiniMap = !(mode === 'photo' && primaryMedia);

  return {
    hasListContext: Boolean(listName),
    hasMiniMap,
    interactionKey: `${place.id}:${mode}:${hasMiniMap ? 'map' : (primaryMedia?.url ?? 'media')}`,
    listContextLabel: `${
      listIsPublic === false ? tr.listDetail.private : tr.listDetail.public
    } · ${tr.cards.placeAddedToList}`,
    media,
    mediaCounts: getPlaceMediaCounts(media),
    primaryMedia,
    timestampText: formatCreatedUpdatedInline(
      place.addedAt,
      place.updatedAt,
    ),
  };
}

type PlaceTileMediaProps = {
  hasMenuActions: boolean;
  hasMiniMap: boolean;
  isMapInteractive: boolean;
  mapFocusKey: number;
  markers: React.ComponentProps<typeof MiniMapPreview>['places'];
  mediaCount: number;
  mediaCounts: ReturnType<typeof getPlaceMediaCounts>;
  mode: 'place' | 'photo';
  onMapGesture: () => void;
  onOpenMenu: () => void;
  place: Place;
  primaryMedia: React.ComponentProps<typeof MediaThumbnailView>['item'] | undefined;
  showInteractionHint: boolean;
};

function PlaceTileMedia({
  hasMenuActions,
  hasMiniMap,
  isMapInteractive,
  mapFocusKey,
  markers,
  mediaCount,
  mediaCounts,
  mode,
  onMapGesture,
  onOpenMenu,
  place,
  primaryMedia,
  showInteractionHint,
}: PlaceTileMediaProps) {
  return (
    <View style={styles.mediaSquare}>
      {hasMenuActions ? (
        <Pressable
          accessibilityLabel={tr.common.contentActionsTitle}
          accessibilityRole="button"
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            onOpenMenu();
          }}
          style={styles.singleActionBadge}
        >
          <Ellipsis color={colors.onPrimary} size={10} />
        </Pressable>
      ) : null}

      {mode === 'photo' && primaryMedia ? (
        <>
          <MediaThumbnailView
            item={primaryMedia}
            priority="high"
            style={styles.mediaSquare}
            accessibilityLabel={tr.placeEditor.placePhotoLabel(place.name)}
            fallbackToVideoPreview={false}
          />
          {mediaCount > 0 ? (
            <View style={styles.photoCountBadge}>
              {mediaCounts.photos > 0 ? (
                <View style={styles.photoCountGroup}>
                  <Camera color={colors.onPrimary} size={9} />
                  <Text style={styles.photoCountText}>{mediaCounts.photos}</Text>
                </View>
              ) : null}
              {mediaCounts.photos > 0 && mediaCounts.videos > 0 ? (
                <View style={styles.photoCountDivider} />
              ) : null}
              {mediaCounts.videos > 0 ? (
                <View style={styles.photoCountGroup}>
                  <PlayCircle color={colors.onPrimary} size={9} />
                  <Text style={styles.photoCountText}>{mediaCounts.videos}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <MiniMapPreview
          places={markers}
          height={layout.discoveryTileHeight}
          interactive={isMapInteractive}
          instanceId={mapFocusKey}
          focusIndex={0}
          focusTrigger={mapFocusKey}
          onMapGesture={onMapGesture}
        />
      )}
      {hasMiniMap ? <MiniMapInteractionHint visible={showInteractionHint} /> : null}
    </View>
  );
}

function PlaceGridTileComponent({
  place,
  owner,
  fillWidth = false,
  showOwner = false,
  mode = 'place',
  listCoverImage,
  listEmoji,
  listIsPublic,
  listName,
  markerColor,
  compact = false,
  onPress,
  onPressIn,
  onOwnerPress,
  onOwnerPressIn,
  menuActions,
  searchQuery,
}: PlaceGridTileProps) {
  const { columnGap, height, width } = useAppLayout();
  const {
    hasListContext,
    hasMiniMap,
    interactionKey,
    listContextLabel,
    media,
    mediaCounts,
    primaryMedia,
    timestampText,
  } = React.useMemo(
    () => getPlaceGridTileModel(place, mode, listIsPublic, listName),
    [listIsPublic, listName, mode, place],
  );
  const mediaCount = media.length;
  const tileWidth = getResponsiveDiscoveryTileWidth(width, height, columnGap);
  const lastMapGestureAtRef = React.useRef(0);
  const handledLongPressRef = React.useRef(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(interactionKey);

  const handleTilePress = () => {
    if (
      Date.now() - lastMapGestureAtRef.current <
      MAP_PRESS_SUPPRESSION_WINDOW_MS
    ) {
      return;
    }

    onPress();
  };

  const miniMapMarkers = React.useMemo(
    () => [
      {
        lat: place.lat,
        lng: place.lng,
        name: place.name,
        markerColor: markerColor ?? getListMarkerColor(listIsPublic),
      },
    ],
    [listIsPublic, markerColor, place.lat, place.lng, place.name],
  );

  return (
    <View
      style={[
        styles.tile,
        compact ? styles.tileCompact : null,
        fillWidth ? styles.tileFullWidth : { width: tileWidth },
      ]}
    >
      {showOwner && owner && !compact ? (
        <OwnerHeader owner={owner} onPress={onOwnerPress} onPressIn={onOwnerPressIn} />
      ) : null}
      <Pressable
        accessibilityLabel={place.name}
        accessibilityRole="button"
        onPress={handleTilePress}
        onPressIn={onPressIn}
        style={styles.tilePressable}
      >
        <PlaceTileMedia
          hasMenuActions={Boolean(menuActions?.length)}
          hasMiniMap={hasMiniMap}
          isMapInteractive={isMapInteractive}
          mapFocusKey={mapFocusKey}
          markers={miniMapMarkers}
          mediaCount={mediaCount}
          mediaCounts={mediaCounts}
          mode={mode}
          onMapGesture={() => {
            lastMapGestureAtRef.current = Date.now();
          }}
          onOpenMenu={() => setMenuVisible(true)}
          place={place}
          primaryMedia={primaryMedia}
          showInteractionHint={showInteractionHint}
        />

        <View style={[styles.tileBody, compact ? styles.tileBodyCompact : null]}>
          <View style={styles.tileTitleRow}>
            <View style={styles.tileTitleContent}>
              <ExpandableText
                text={place.name}
                collapsedLines={1}
                textStyle={styles.tileTitle}
                showIndicator={false}
                renderContent={() => <HighlightedText query={searchQuery} text={place.name} />}
              />
            </View>
            {hasMiniMap && !compact ? (
              <Pressable
                accessibilityLabel={tr.cards.focusMiniMap}
                accessibilityRole="button"
                delayLongPress={MINI_MAP_RESET_LONG_PRESS_MS}
                hitSlop={8}
                onPressIn={() => {
                  handledLongPressRef.current = false;
                }}
                onPress={(event) => {
                  event.stopPropagation();
                  if (handledLongPressRef.current) {
                    handledLongPressRef.current = false;
                    return;
                  }

                  activateMap();
                }}
                onLongPress={(event) => {
                  event.stopPropagation();
                  handledLongPressRef.current = true;
                  deactivateMap();
                }}
                style={[
                  styles.titleActionButton,
                  isMapInteractive ? styles.titleActionButtonActive : null,
                ]}
              >
                <Crosshair color={colors.primary} size={10} />
              </Pressable>
            ) : null}
          </View>
          {hasListContext && !compact ? (
            <View style={styles.listContextBar}>
              {listCoverImage ? (
                <AppImage
                  uri={listCoverImage}
                  style={styles.listContextCover}
                  accessibilityLabel={tr.cards.listCoverImageLabel(
                    listName || '',
                  )}
                />
              ) : (
                <View style={styles.listContextCoverFallback}>
                  <ListIcon color={colors.primary} size={10} />
                </View>
              )}
              <View style={styles.listContextBody}>
                <View style={styles.listContextTitleRow}>
                  <ListIcon color={colors.primary} size={9} />
                  <ExpandableText
                    text={
                      listEmoji ? `${listEmoji} ${listName}` : listName || ''
                    }
                    collapsedLines={1}
                    textStyle={styles.listContextTitle}
                    showIndicator={false}
                  />
                </View>
                <View style={styles.listContextMetaRow}>
                  {listIsPublic === false ? (
                    <Lock color={colors.visibilityPrivate} size={9} />
                  ) : (
                    <Globe color={colors.secondary} size={9} />
                  )}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.listContextMetaText,
                      listIsPublic === false
                        ? styles.listContextMetaTextPrivate
                        : null,
                    ]}
                  >
                    {listContextLabel}
                  </Text>
                </View>
              </View>
              <ChevronRight color={colors.primary} size={10} />
            </View>
          ) : null}
          <View style={styles.tileSecondaryRow}>
            {place.rating ? (
              <View style={styles.ratingRow}>
                <Star color={colors.rating} fill={colors.rating} size={9} />
                <Text style={styles.ratingText}>{place.rating}</Text>
              </View>
            ) : null}
            {!compact ? (
              <Text numberOfLines={1} style={styles.tileTimestampInline}>
                {timestampText}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {menuVisible && menuActions?.length ? (
        <DeferredActionMenuSheet
          visible
          title={place.name}
          items={menuActions.map((item) => ({
            ...item,
            onPress: () => {
              setMenuVisible(false);
              item.onPress();
            },
          }))}
          onClose={() => setMenuVisible(false)}
        />
      ) : null}
    </View>
  );
}

function arePlaceGridTilePropsEqual(
  previous: PlaceGridTileProps,
  next: PlaceGridTileProps,
) {
  return (
    previous.place === next.place &&
    previous.owner === next.owner &&
    previous.fillWidth === next.fillWidth &&
    previous.showOwner === next.showOwner &&
    previous.mode === next.mode &&
    previous.listCoverImage === next.listCoverImage &&
    previous.listEmoji === next.listEmoji &&
    previous.listIsPublic === next.listIsPublic &&
    previous.listName === next.listName &&
    previous.markerColor === next.markerColor &&
    previous.compact === next.compact &&
    previous.onPress === next.onPress &&
    previous.onPressIn === next.onPressIn &&
    previous.onOwnerPress === next.onOwnerPress &&
    previous.onOwnerPressIn === next.onOwnerPressIn &&
    previous.menuActions === next.menuActions
    && previous.searchQuery === next.searchQuery
  );
}

export const PlaceGridTile = React.memo(
  PlaceGridTileComponent,
  arePlaceGridTilePropsEqual,
);
