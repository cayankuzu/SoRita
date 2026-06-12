import React from 'react';
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Crosshair,
  Globe,
  Heart,
  Lock,
  Pencil,
  Trash2,
} from 'lucide-react-native';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
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
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { getMapMarkers } from '@/mobile/app/shared/utils/format';
import { getResponsiveDiscoveryTileWidth } from '@/mobile/app/shared/utils/layout';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

export type ListGridTileProps = {
  list: PlaceList;
  owner?: User | null;
  showOwner?: boolean;
  showPrivacyBadge?: boolean;
  onPress: () => void;
  onOwnerPress?: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
};

function ListGridTileComponent({
  list,
  owner,
  showOwner = false,
  showPrivacyBadge = false,
  onPress,
  onOwnerPress,
  onEditPress,
  onDeletePress,
}: ListGridTileProps) {
  const { height, width } = useWindowDimensions();
  const coverPhoto = list.coverImage || null;
  const timestampText = formatCreatedUpdatedInline(list.createdAt, list.updatedAt);
  const [coverLoadFailed, setCoverLoadFailed] = React.useState(false);
  const tileWidth = getResponsiveDiscoveryTileWidth(width, height);
  const lastMapGestureAtRef = React.useRef(0);
  const handledLongPressRef = React.useRef(false);
  const hasMiniMap = (!coverPhoto || coverLoadFailed) && list.places.length > 0;
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
    if (Date.now() - lastMapGestureAtRef.current < MAP_PRESS_SUPPRESSION_WINDOW_MS) {
      return;
    }

    onPress();
  };

  return (
    <View style={[styles.tile, { width: tileWidth }]}>
      {showOwner && owner ? <OwnerHeader owner={owner} onPress={onOwnerPress} /> : null}
      <Pressable onPress={handleTilePress} style={styles.tilePressable}>
        <View style={styles.mediaSquare}>
          {coverPhoto && !coverLoadFailed ? (
            <AppImage
              uri={coverPhoto}
              style={styles.mediaSquare}
              accessibilityLabel={`${list.name} kapak gorseli`}
              onError={() => setCoverLoadFailed(true)}
            />
          ) : list.places.length > 0 ? (
            <MiniMapPreview
              places={getMapMarkers(list.places, list.isPublic)}
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
              <Text style={styles.placeholderEmoji}>{list.emoji || tr.placeEditor.defaultEmoji}</Text>
            </View>
          )}
          {hasMiniMap ? <MiniMapInteractionHint visible={showInteractionHint} /> : null}

          {showPrivacyBadge ? (
            <View style={styles.iconBadgeLeft}>
              {list.isPublic ? <Globe color={colors.onPrimary} size={12} /> : <Lock color={colors.onPrimary} size={12} />}
            </View>
          ) : null}

          {onEditPress || onDeletePress ? (
            <View style={styles.actionBadgeColumn}>
              {onEditPress ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onEditPress();
                  }}
                  style={styles.iconBadgeRight}
                >
                  <Pencil color={colors.onPrimary} size={12} />
                </Pressable>
              ) : null}
              {onDeletePress ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onDeletePress();
                  }}
                  style={styles.iconBadgeRight}
                >
                  <Trash2 color={colors.onPrimary} size={12} />
                </Pressable>
              ) : null}
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
              />
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
          {list.description ? (
            <ExpandableText text={list.description} collapsedLines={1} textStyle={styles.tileDescription} />
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.tileMeta}>{tr.cards.placesCount(list.places.length)}</Text>
            {(list.likes || 0) > 0 ? (
              <View style={styles.metaLike}>
                <Heart color={colors.textSoft} size={10} />
                <Text style={styles.tileMeta}>{list.likes}</Text>
              </View>
            ) : null}
          </View>
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

function areListGridTilePropsEqual(previous: ListGridTileProps, next: ListGridTileProps) {
  return (
    previous.list === next.list &&
    previous.owner === next.owner &&
    previous.showOwner === next.showOwner &&
    previous.showPrivacyBadge === next.showPrivacyBadge
  );
}

export const ListGridTile = React.memo(ListGridTileComponent, areListGridTilePropsEqual);
