import React from 'react';
import { View } from 'react-native';
import { Crosshair, Ellipsis, Globe, Heart, Lock } from 'lucide-react-native';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { ListCoverFallback } from '@/mobile/app/shared/components/media/ListCoverFallback';
import { OwnerHeader } from '@/mobile/app/features/discovery/ui/components/OwnerHeader';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import type { ActionMenuSheetItem } from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { DeferredActionMenuSheet } from '@/mobile/app/shared/components/feedback/DeferredActionMenuSheet';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { useMiniMapInteraction } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { HighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, layout } from '@/mobile/app/shared/theme/tokens';
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
  hasMiniMap: boolean;
  isMapInteractive: boolean;
  list: PlaceList;
  mapFocusKey: number;
  markers: React.ComponentProps<typeof MiniMapPreview>['places'];
  onCoverLoadError: () => void;
  onMapGesture: () => void;
  placeCount: number;
  showInteractionHint: boolean;
  showPrivacyBadge: boolean;
};

function ListTileMedia({
  compact,
  coverLoadFailed,
  coverPhoto,
  hasMiniMap,
  isMapInteractive,
  list,
  mapFocusKey,
  markers,
  onCoverLoadError,
  onMapGesture,
  placeCount,
  showInteractionHint,
  showPrivacyBadge,
}: ListTileMediaProps) {
  const visibilityLabel = list.isPublic
    ? tr.listEditor.privacyPublicShort
    : tr.listEditor.privacyPrivate;

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
        <ListCoverFallback emoji={list.emoji || tr.placeEditor.defaultEmoji} seed={list.id} />
      )}

      {hasMiniMap ? <MiniMapInteractionHint visible={showInteractionHint} /> : null}

      {showPrivacyBadge ? (
        <Badge
          accessibilityLabel={compact ? visibilityLabel : undefined}
          icon={list.isPublic ? Globe : Lock}
          label={compact ? undefined : visibilityLabel}
          style={styles.visibilityBadge}
          tone="overlay"
        />
      ) : null}

      {(list.likes || 0) > 0 ? (
        <View style={styles.mediaFooterRow}>
          <Badge icon={Heart} iconFilled label={String(list.likes)} numeric tone="overlay" />
        </View>
      ) : null}
    </View>
  );
}

function ListMiniMapToggle({
  activateMap,
  compact,
  deactivateMap,
  hasMiniMap,
  isMapInteractive,
}: {
  activateMap: () => void;
  compact: boolean;
  deactivateMap: () => void;
  hasMiniMap: boolean;
  isMapInteractive: boolean;
}) {
  if (!hasMiniMap || compact) {
    return null;
  }

  return (
    <InstantPressable
      accessibilityLabel={isMapInteractive ? tr.cards.hideMiniMap : tr.cards.focusMiniMap}
      accessibilityRole="button"
      accessibilityState={{ selected: isMapInteractive }}
      onPress={() => {
        if (isMapInteractive) {
          deactivateMap();
        } else {
          activateMap();
        }
      }}
      style={[styles.titleActionButton, styles.titleActionOverlay]}
    >
      <View
        style={[
          styles.titleActionButtonVisual,
          isMapInteractive ? styles.titleActionButtonActive : null,
        ]}
      >
        <Crosshair color={colors.primary} size={iconSize.xs} />
      </View>
    </InstantPressable>
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
      <View style={styles.tileActionShell}>
        <InstantPressable
          accessible={!isMapInteractive}
          accessibilityLabel={
            isMapInteractive
              ? undefined
              : `${tr.common.list}: ${list.name}. ${tr.cards.placesCount(placeCount)}${
                  showPrivacyBadge
                    ? `. ${list.isPublic ? tr.listEditor.privacyPublicShort : tr.listEditor.privacyPrivate}`
                    : ''
                }`
          }
          accessibilityRole={isMapInteractive ? undefined : 'button'}
          onPress={isMapInteractive ? undefined : handleTilePress}
          onPressIn={isMapInteractive ? undefined : onPressIn}
          pointerEvents={isMapInteractive ? 'box-none' : 'auto'}
          style={styles.tilePressable}
        >
          <ListTileMedia
            compact={compact}
            coverLoadFailed={coverLoadFailed}
            coverPhoto={coverPhoto}
            hasMiniMap={hasMiniMap}
            isMapInteractive={isMapInteractive}
            list={list}
            mapFocusKey={mapFocusKey}
            markers={miniMapMarkers}
            onCoverLoadError={() => setCoverLoadFailed(true)}
            onMapGesture={() => {
              lastMapGestureAtRef.current = Date.now();
            }}
            placeCount={placeCount}
            showInteractionHint={showInteractionHint}
            showPrivacyBadge={showPrivacyBadge}
          />

          <View style={[styles.tileBody, compact ? styles.tileBodyCompact : null]}>
            <View style={styles.tileTitleRow}>
              <View style={styles.tileTitleContent}>
                <AppText numberOfLines={1} style={styles.tileTitle}>
                  <HighlightedText
                    query={searchQuery}
                    text={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
                  />
                </AppText>
              </View>
              {hasMiniMap && !compact ? <View style={styles.titleActionPlaceholder} /> : null}
            </View>
            <AppText numberOfLines={2} style={styles.tileMetaSummary}>
              {tr.cards.placesCount(placeCount)}
              {!compact && timestampText ? ` · ${timestampText}` : ''}
            </AppText>
          </View>
        </InstantPressable>

        {menuActions?.length ? (
          <InstantPressable
            accessibilityLabel={tr.common.contentActionsTitle}
            accessibilityRole="button"
            onPress={() => setMenuVisible(true)}
            style={styles.singleActionBadge}
          >
            <View style={styles.singleActionBadgeVisual}>
              <Ellipsis color={colors.onPrimary} size={iconSize.xs} />
            </View>
          </InstantPressable>
        ) : null}

        <ListMiniMapToggle
          activateMap={activateMap}
          compact={compact}
          deactivateMap={deactivateMap}
          hasMiniMap={hasMiniMap}
          isMapInteractive={isMapInteractive}
        />
      </View>

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
