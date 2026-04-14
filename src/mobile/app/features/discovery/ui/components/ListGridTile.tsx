import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Globe,
  Heart,
  Lock,
  Pencil,
  Trash2,
} from 'lucide-react-native';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { OwnerHeader } from '@/mobile/app/features/discovery/ui/components/OwnerHeader';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { getMapMarkers } from '@/mobile/app/shared/utils/format';

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
  const coverPhoto = list.coverImage || null;
  const timestampText = formatCreatedUpdatedInline(list.createdAt, list.updatedAt);
  const [coverLoadFailed, setCoverLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setCoverLoadFailed(false);
  }, [coverPhoto]);

  return (
    <View style={styles.tile}>
      {showOwner && owner ? <OwnerHeader owner={owner} onPress={onOwnerPress} /> : null}
      <Pressable onPress={onPress} style={styles.tilePressable}>
        <View style={styles.mediaSquare}>
          {coverPhoto && !coverLoadFailed ? (
            <Image
              source={{ uri: coverPhoto }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              onError={() => setCoverLoadFailed(true)}
            />
          ) : list.places.length > 0 ? (
            <MiniMapPreview places={getMapMarkers(list.places, list.isPublic)} height={layout.discoveryTileHeight} />
          ) : (
            <View style={styles.placeholderSquare}>
              <Text style={styles.placeholderEmoji}>{list.emoji || tr.placeEditor.defaultEmoji}</Text>
            </View>
          )}

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
          <ExpandableText
            text={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
            collapsedLines={1}
            textStyle={styles.tileTitle}
            showIndicator={false}
          />
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
