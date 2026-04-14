import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  Pencil,
  Star,
} from 'lucide-react-native';

import type { Place, User } from '@/mobile/app/data/contracts/entities';
import { OwnerHeader } from '@/mobile/app/features/discovery/ui/components/OwnerHeader';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { colors, layout } from '@/mobile/app/shared/theme/tokens';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { getListMarkerColor } from '@/mobile/app/shared/utils/format';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

export type PlaceGridTileProps = {
  place: Place;
  owner?: User | null;
  showOwner?: boolean;
  mode?: 'place' | 'photo';
  listIsPublic?: boolean;
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
  listIsPublic,
  markerContext = 'feed',
  onPress,
  onOwnerPress,
  onEditPress,
}: PlaceGridTileProps) {
  const photoUrl = place.photos?.[0];
  const photoCount = place.photos?.length || 0;
  const timestampText = formatCreatedUpdatedInline(place.addedAt, place.updatedAt || place.addedAt);
  const lastMapGestureAtRef = React.useRef(0);

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
    <View style={styles.tile}>
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
              <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFillObject} />
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
              interactive
              onMapGesture={() => {
                lastMapGestureAtRef.current = Date.now();
              }}
            />
          )}
        </View>

        <View style={styles.tileBody}>
          <ExpandableText text={place.name} collapsedLines={1} textStyle={styles.tileTitle} showIndicator={false} />
          {place.notes ? (
            <ExpandableText text={place.notes} collapsedLines={1} textStyle={styles.tileDescription} />
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
    previous.listIsPublic === next.listIsPublic &&
    previous.markerContext === next.markerContext
  );
}

export const PlaceGridTile = React.memo(PlaceGridTileComponent, arePlaceGridTilePropsEqual);
