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
  onPress: () => void;
  onOwnerPress?: () => void;
  menuActions?: ActionMenuSheetItem[];
  searchQuery?: string;
};

function ListGridTileComponent({
  list,
  owner,
  fillWidth = false,
  showOwner = false,
  showPrivacyBadge = false,
  allListsForMarkerColor,
  onPress,
  onOwnerPress,
  menuActions,
  searchQuery,
}: ListGridTileProps) {
  const { columnGap, height, width } = useAppLayout();
  const coverPhoto = list.coverImage || null;
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
        fillWidth ? styles.tileFullWidth : { width: tileWidth },
      ]}
    >
      {showOwner && owner ? (
        <OwnerHeader owner={owner} onPress={onOwnerPress} />
      ) : null}
      <Pressable onPress={handleTilePress} style={styles.tilePressable}>
        <View style={styles.mediaSquare}>
          {coverPhoto && !coverLoadFailed ? (
            <AppImage
              uri={coverPhoto}
              style={styles.mediaSquare}
              accessibilityLabel={tr.cards.listCoverImageLabel(list.name)}
              onError={() => setCoverLoadFailed(true)}
            />
          ) : list.places.length > 0 ? (
            <MiniMapPreview
              places={miniMapMarkers}
              height={layout.discoveryTileHeight}
              interactive={isMapInteractive}
              instanceId={mapFocusKey}
              focusTrigger={mapFocusKey}
              onMapGesture={() => {
                lastMapGestureAtRef.current = Date.now();
              }}
            />
          ) : (
            <View style={styles.placeholderSquare}>
              <Text style={styles.placeholderEmoji}>
                {list.emoji || tr.placeEditor.defaultEmoji}
              </Text>
            </View>
          )}
          {hasMiniMap ? (
            <MiniMapInteractionHint visible={showInteractionHint} />
          ) : null}

          {showPrivacyBadge ? (
            <View style={styles.visibilityBadge}>
              {list.isPublic ? (
                <Globe color={colors.onPrimary} size={10} />
              ) : (
                <Lock color={colors.onPrimary} size={10} />
              )}
              <Text style={styles.visibilityBadgeText}>
                {list.isPublic ? tr.listEditor.privacyPublicShort : tr.listEditor.privacyPrivate}
              </Text>
            </View>
          ) : null}

          {menuActions?.length ? (
            <Pressable
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                setMenuVisible(true);
              }}
              style={styles.singleActionBadge}
            >
              <Ellipsis color={colors.onPrimary} size={10} />
            </Pressable>
          ) : null}

          {(list.likes || 0) > 0 ? (
            <View style={styles.mediaFooterRow}>
              <View style={styles.mediaFooterBadge}>
                <Heart
                  color={colors.onPrimary}
                  size={10}
                  fill={colors.onPrimary}
                />
                <Text style={styles.mediaFooterBadgeText}>{list.likes}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.tileBody}>
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
                <Crosshair color={colors.primary} size={10} />
              </Pressable>
            ) : null}
          </View>
          <Text numberOfLines={2} style={styles.tileMetaSummary}>
            {tr.cards.placesCount(list.places.length)}
            {timestampText ? ` · ${timestampText}` : ''}
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
