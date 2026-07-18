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
import {
  ActionMenuSheet,
  type ActionMenuSheetItem,
} from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import {
  MINI_MAP_RESET_LONG_PRESS_MS,
  useMiniMapInteraction,
} from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
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
  markerContext?: 'feed' | 'list';
  onPress: () => void;
  onOwnerPress?: () => void;
  menuActions?: ActionMenuSheetItem[];
};

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
  markerContext = 'feed',
  onPress,
  onOwnerPress,
  menuActions,
}: PlaceGridTileProps) {
  const { columnGap, height, width } = useAppLayout();
  const media = getPlaceMedia(place);
  const primaryMedia = media[0];
  const mediaCounts = getPlaceMediaCounts(media);
  const mediaCount = media.length;
  const timestampText = formatCreatedUpdatedInline(
    place.addedAt,
    place.updatedAt || place.addedAt,
  );
  const tileWidth = getResponsiveDiscoveryTileWidth(width, height, columnGap);
  const lastMapGestureAtRef = React.useRef(0);
  const handledLongPressRef = React.useRef(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const hasMiniMap = !(mode === 'photo' && primaryMedia);
  const hasListContext = Boolean(listName);
  const listContextLabel =
    listIsPublic === false
      ? 'Ozel listeye eklendi'
      : 'Herkese acik listeye eklendi';
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(
    `${place.id}:${mode}:${hasMiniMap ? 'map' : (primaryMedia?.url ?? 'media')}`,
  );

  const handleTilePress = () => {
    if (
      Date.now() - lastMapGestureAtRef.current <
      MAP_PRESS_SUPPRESSION_WINDOW_MS
    ) {
      return;
    }

    onPress();
  };

  void markerContext;

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
        fillWidth ? styles.tileFullWidth : { width: tileWidth },
      ]}
    >
      {showOwner && owner ? (
        <OwnerHeader owner={owner} onPress={onOwnerPress} />
      ) : null}
      <Pressable onPress={handleTilePress} style={styles.tilePressable}>
        <View style={styles.mediaSquare}>
          {menuActions?.length ? (
            <Pressable
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                setMenuVisible(true);
              }}
              style={styles.singleActionBadge}
            >
              <Ellipsis color={colors.onPrimary} size={14} />
            </Pressable>
          ) : null}

          {mode === 'photo' && primaryMedia ? (
            <>
              <MediaThumbnailView
                item={primaryMedia}
                style={styles.mediaSquare}
                accessibilityLabel={`${place.name} fotografi`}
                fallbackToVideoPreview={false}
              />
              {mediaCount > 0 ? (
                <View style={styles.photoCountBadge}>
                  {mediaCounts.photos > 0 ? (
                    <View style={styles.photoCountGroup}>
                      <Camera color={colors.onPrimary} size={10} />
                      <Text style={styles.photoCountText}>
                        {mediaCounts.photos}
                      </Text>
                    </View>
                  ) : null}
                  {mediaCounts.photos > 0 && mediaCounts.videos > 0 ? (
                    <View style={styles.photoCountDivider} />
                  ) : null}
                  {mediaCounts.videos > 0 ? (
                    <View style={styles.photoCountGroup}>
                      <PlayCircle color={colors.onPrimary} size={10} />
                      <Text style={styles.photoCountText}>
                        {mediaCounts.videos}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
            <MiniMapPreview
              places={miniMapMarkers}
              height={layout.discoveryTileHeight}
              interactive={isMapInteractive}
              instanceId={mapFocusKey}
              focusIndex={0}
              focusTrigger={mapFocusKey}
              onMapGesture={() => {
                lastMapGestureAtRef.current = Date.now();
              }}
            />
          )}
          {hasMiniMap ? (
            <MiniMapInteractionHint visible={showInteractionHint} />
          ) : null}
        </View>

        <View style={styles.tileBody}>
          <View style={styles.tileTitleRow}>
            <View style={styles.tileTitleContent}>
              <ExpandableText
                text={place.name}
                collapsedLines={1}
                textStyle={styles.tileTitle}
                showIndicator={false}
              />
            </View>
            {hasMiniMap ? (
              <Pressable
                accessibilityLabel={tr.cards.focusMiniMap}
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
                <Crosshair color={colors.primary} size={14} />
              </Pressable>
            ) : null}
          </View>
          {place.notes ? (
            <ExpandableText
              text={place.notes}
              collapsedLines={1}
              preserveLineBreaks
              maxCollapsedLinesWhenPreservingBreaks={3}
              textStyle={styles.tileDescription}
            />
          ) : null}
          {hasListContext ? (
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
                  <ListIcon color={colors.primary} size={14} />
                </View>
              )}
              <View style={styles.listContextBody}>
                <View style={styles.listContextTitleRow}>
                  <ListIcon color={colors.primary} size={11} />
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
                    <Lock color={colors.danger} size={11} />
                  ) : (
                    <Globe color={colors.secondary} size={11} />
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
              <ChevronRight color={colors.primary} size={14} />
            </View>
          ) : null}
          {place.rating ? (
            <View style={styles.ratingRow}>
              <Star color={colors.warning} fill={colors.warning} size={10} />
              <Text style={styles.ratingText}>{place.rating}</Text>
            </View>
          ) : null}
          <Text numberOfLines={1} style={styles.tileTimestamp}>
            {timestampText}
          </Text>
        </View>
      </Pressable>

      {menuVisible && menuActions?.length ? (
        <ActionMenuSheet
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
    previous.markerContext === next.markerContext &&
    previous.onPress === next.onPress &&
    previous.onOwnerPress === next.onOwnerPress &&
    previous.menuActions === next.menuActions
  );
}

export const PlaceGridTile = React.memo(
  PlaceGridTileComponent,
  arePlaceGridTilePropsEqual,
);
