import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Crosshair, Ellipsis, Globe, Heart, Lock } from 'lucide-react-native';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
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
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { HighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import {
  getMapMarkers,
  getMarkerColorForPlaceAcrossLists,
} from '@/mobile/app/shared/utils/markerColors';
import { getResponsiveDiscoveryTileWidth } from '@/mobile/app/shared/utils/layout';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

export type ListGridTileProps = {
  list: PlaceList;
  owner?: User | null;
  fillWidth?: boolean;
  showOwner?: boolean;
  showPrivacyBadge?: boolean;
  allListsForMarkerColor?: PlaceList[];
  compact?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onOwnerPress?: () => void;
  onOwnerPressIn?: () => void;
  menuActions?: ActionMenuSheetItem[];
  searchQuery?: string;
};

type ListTileMediaProps = {
  compact: boolean;
  coverLoadFailed: boolean;
  coverPhoto: string | null;
  hasMenuActions: boolean;
  hasMiniMap: boolean;
  isMapInteractive: boolean;
  list: PlaceList;
  mapFocusKey: number;
  markers: React.ComponentProps<typeof MiniMapPreview>['places'];
  onCoverLoadError: () => void;
  onMapGesture: () => void;
  onOpenMenu: () => void;
  placeCount: number;
  showInteractionHint: boolean;
  showPrivacyBadge: boolean;
};

function ListTileMedia({
  compact,
  coverLoadFailed,
  coverPhoto,
  hasMenuActions,
  hasMiniMap,
  isMapInteractive,
  list,
  mapFocusKey,
  markers,
  onCoverLoadError,
  onMapGesture,
  onOpenMenu,
  placeCount,
  showInteractionHint,
  showPrivacyBadge,
}: ListTileMediaProps) {
  return (
    <View style={styles.mediaSquare}>
      {coverPhoto && !coverLoadFailed ? (
        <AppImage
          uri={coverPhoto}
          style={styles.mediaSquare}
          accessibilityLabel={tr.cards.listCoverImageLabel(list.name)}
          onError={onCoverLoadError}
        />
      ) : placeCount > 0 && list.places.length > 0 ? (
        <MiniMapPreview
          places={markers}
          height={layout.discoveryTileHeight}
          interactive={isMapInteractive}
          instanceId={mapFocusKey}
          focusTrigger={mapFocusKey}
          onMapGesture={onMapGesture}
        />
      ) : (
        <View style={styles.placeholderSquare}>
          <Text style={styles.placeholderEmoji}>
            {list.emoji || tr.placeEditor.defaultEmoji}
          </Text>
        </View>
      )}

      {hasMiniMap ? <MiniMapInteractionHint visible={showInteractionHint} /> : null}

      {showPrivacyBadge ? (
        <View style={styles.visibilityBadge}>
          {list.isPublic ? (
            <Globe color={colors.onPrimary} size={10} />
          ) : (
            <Lock color={colors.onPrimary} size={10} />
          )}
          {!compact ? (
            <Text style={styles.visibilityBadgeText}>
              {list.isPublic ? tr.listEditor.privacyPublicShort : tr.listEditor.privacyPrivate}
            </Text>
          ) : null}
        </View>
      ) : null}

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

      {(list.likes || 0) > 0 ? (
        <View style={styles.mediaFooterRow}>
          <View style={styles.mediaFooterBadge}>
            <Heart color={colors.onPrimary} size={10} fill={colors.onPrimary} />
            <Text style={styles.mediaFooterBadgeText}>{list.likes}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ListGridTileComponent({
  list,
  owner,
  fillWidth = false,
  showOwner = false,
  showPrivacyBadge = false,
  allListsForMarkerColor,
  compact = false,
  onPress,
  onPressIn,
  onOwnerPress,
  onOwnerPressIn,
  menuActions,
  searchQuery,
}: ListGridTileProps) {
  const { columnGap, height, width } = useAppLayout();
  const coverPhoto = list.coverImage || null;
  const placeCount = list.placeCount ?? list.places.length;
  const timestampText = formatCreatedUpdatedInline(
    list.createdAt,
    list.updatedAt,
  );
  const [coverLoadFailed, setCoverLoadFailed] = React.useState(false);
  const tileWidth = getResponsiveDiscoveryTileWidth(width, height, columnGap);
  const lastMapGestureAtRef = React.useRef(0);
  const handledLongPressRef = React.useRef(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const hasMiniMap = (!coverPhoto || coverLoadFailed) && list.places.length > 0;
  const miniMapMarkers = React.useMemo(
    () => hasMiniMap
      ? getMapMarkers(list.places, list.isPublic, (place) =>
          getMarkerColorForPlaceAcrossLists(
            place,
            allListsForMarkerColor ?? [list],
            list.isPublic,
          ))
      : [],
    [allListsForMarkerColor, hasMiniMap, list],
  );
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(
    `${list.id}:${coverPhoto ?? 'none'}:${coverLoadFailed ? 'fallback' : 'cover'}:${hasMiniMap ? 'map' : 'media'}`,
  );

  React.useEffect(() => {
    setCoverLoadFailed(false);
  }, [coverPhoto]);

  const handleTilePress = () => {
    if (
      Date.now() - lastMapGestureAtRef.current <
      MAP_PRESS_SUPPRESSION_WINDOW_MS
    ) {
      return;
    }

    onPress();
  };

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
        accessibilityLabel={list.name}
        accessibilityRole="button"
        onPress={handleTilePress}
        onPressIn={onPressIn}
        style={styles.tilePressable}
      >
        <ListTileMedia
          compact={compact}
          coverLoadFailed={coverLoadFailed}
          coverPhoto={coverPhoto}
          hasMenuActions={Boolean(menuActions?.length)}
          hasMiniMap={hasMiniMap}
          isMapInteractive={isMapInteractive}
          list={list}
          mapFocusKey={mapFocusKey}
          markers={miniMapMarkers}
          onCoverLoadError={() => setCoverLoadFailed(true)}
          onMapGesture={() => {
            lastMapGestureAtRef.current = Date.now();
          }}
          onOpenMenu={() => setMenuVisible(true)}
          placeCount={placeCount}
          showInteractionHint={showInteractionHint}
          showPrivacyBadge={showPrivacyBadge}
        />

        <View style={[styles.tileBody, compact ? styles.tileBodyCompact : null]}>
          <View style={styles.tileTitleRow}>
            <View style={styles.tileTitleContent}>
              <ExpandableText
                text={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
                collapsedLines={1}
                textStyle={styles.tileTitle}
                showIndicator={false}
                renderContent={() => (
                  <HighlightedText
                    query={searchQuery}
                    text={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
                  />
                )}
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
          <Text numberOfLines={2} style={styles.tileMetaSummary}>
            {tr.cards.placesCount(placeCount)}
            {!compact && timestampText ? ` · ${timestampText}` : ''}
          </Text>
        </View>
      </Pressable>

      {menuVisible && menuActions?.length ? (
        <DeferredActionMenuSheet
          visible
          title={list.name}
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

export const ListGridTile = React.memo(ListGridTileComponent);
