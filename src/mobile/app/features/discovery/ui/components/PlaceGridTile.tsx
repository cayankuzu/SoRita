import React from 'react';
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Camera,
  ChevronRight,
  Crosshair,
  Globe,
  List as ListIcon,
  Lock,
  Pencil,
  Star,
} from 'lucide-react-native';

import type { Place, User } from '@/mobile/app/data/contracts/entities';
import { OwnerHeader } from '@/mobile/app/features/discovery/ui/components/OwnerHeader';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import {
  MINI_MAP_RESET_LONG_PRESS_MS,
  useMiniMapInteraction,
} from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { getListMarkerColor } from '@/mobile/app/shared/utils/format';
import { getResponsiveDiscoveryTileWidth } from '@/mobile/app/shared/utils/layout';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

export type PlaceGridTileProps = {
  place: Place;
  owner?: User | null;
  showOwner?: boolean;
  mode?: 'place' | 'photo';
  listCoverImage?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listName?: string;
  markerContext?: 'feed' | 'list';
  onPress: () => void;
  onOwnerPress?: () => void;
  onEditPress?: () => void;
};

function PlaceGridTileComponent({
  place,
  owner,
  showOwner = false,
  mode = 'place',
  listCoverImage,
  listEmoji,
  listIsPublic,
  listName,
  markerContext = 'feed',
  onPress,
  onOwnerPress,
  onEditPress,
}: PlaceGridTileProps) {
  const { height, width } = useWindowDimensions();
  const photoUrl = place.photos?.[0];
  const photoCount = place.photos?.length || 0;
  const timestampText = formatCreatedUpdatedInline(place.addedAt, place.updatedAt || place.addedAt);
  const tileWidth = getResponsiveDiscoveryTileWidth(width, height);
  const lastMapGestureAtRef = React.useRef(0);
  const handledLongPressRef = React.useRef(false);
  const hasMiniMap = !(mode === 'photo' && photoUrl);
  const hasListContext = Boolean(listName);
  const listContextLabel =
    listIsPublic === false ? 'Ozel listeye eklendi' : 'Herkese acik listeye eklendi';
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(`${place.id}:${mode}:${hasMiniMap ? 'map' : photoUrl ?? 'photo'}`);

  const handleTilePress = () => {
    if (Date.now() - lastMapGestureAtRef.current < MAP_PRESS_SUPPRESSION_WINDOW_MS) {
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
        markerColor: getListMarkerColor(listIsPublic),
      },
    ],
    [listIsPublic, place.lat, place.lng, place.name],
  );

  return (
    <View style={[styles.tile, { width: tileWidth }]}>
      {showOwner && owner ? <OwnerHeader owner={owner} onPress={onOwnerPress} /> : null}
      <Pressable onPress={handleTilePress} style={styles.tilePressable}>
        <View style={styles.mediaSquare}>
          {onEditPress ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onEditPress();
              }}
              style={styles.singleActionBadge}
            >
              <Pencil color={colors.onPrimary} size={12} />
            </Pressable>
          ) : null}

          {mode === 'photo' && photoUrl ? (
            <>
              <AppImage
                uri={photoUrl}
                style={styles.mediaSquare}
                accessibilityLabel={`${place.name} fotografi`}
              />
              {photoCount > 1 ? (
                <View style={styles.photoCountBadge}>
                  <Camera color={colors.onPrimary} size={10} />
                  <Text style={styles.photoCountText}>{photoCount}</Text>
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
          {hasMiniMap ? <MiniMapInteractionHint visible={showInteractionHint} /> : null}
        </View>

        <View style={styles.tileBody}>
          <View style={styles.tileTitleRow}>
            <View style={styles.tileTitleContent}>
              <ExpandableText text={place.name} collapsedLines={1} textStyle={styles.tileTitle} showIndicator={false} />
            </View>
            {hasMiniMap ? (
              <Pressable
                accessibilityLabel="Mini haritayi odakla"
                delayLongPress={MINI_MAP_RESET_LONG_PRESS_MS}
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
            <ExpandableText text={place.notes} collapsedLines={1} textStyle={styles.tileDescription} />
          ) : null}
          {hasListContext ? (
            <View style={styles.listContextBar}>
              {listCoverImage ? (
                <AppImage
                  uri={listCoverImage}
                  style={styles.listContextCover}
                  accessibilityLabel={`${listName} kapak gorseli`}
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
                    text={listEmoji ? `${listEmoji} ${listName}` : listName || ''}
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
                      listIsPublic === false ? styles.listContextMetaTextPrivate : null,
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
          {timestampText ? (
            <Text numberOfLines={2} style={styles.tileTimestamp}>
              {timestampText}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function arePlaceGridTilePropsEqual(previous: PlaceGridTileProps, next: PlaceGridTileProps) {
  return (
    previous.place === next.place &&
    previous.owner === next.owner &&
    previous.showOwner === next.showOwner &&
    previous.mode === next.mode &&
    previous.listCoverImage === next.listCoverImage &&
    previous.listEmoji === next.listEmoji &&
    previous.listIsPublic === next.listIsPublic &&
    previous.listName === next.listName &&
    previous.markerContext === next.markerContext
  );
}

export const PlaceGridTile = React.memo(PlaceGridTileComponent, arePlaceGridTilePropsEqual);
