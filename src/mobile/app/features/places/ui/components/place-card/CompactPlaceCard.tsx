import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Star } from 'lucide-react-native';

import type { Place } from '@/mobile/app/data/contracts/entities';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

type CompactMapMarker = {
  lat: number;
  lng: number;
  name: string;
  markerColor: string;
};

type CompactPlaceCardProps = {
  mapMarkers: CompactMapMarker[];
  photos: string[];
  place: Place;
  placeTimestampLabels: string[];
  onPress?: () => void;
};

export function CompactPlaceCard({
  mapMarkers,
  photos,
  place,
  placeTimestampLabels,
  onPress,
}: CompactPlaceCardProps) {
  const lastCompactMapGestureAtRef = React.useRef(0);

  return (
    <Pressable
      style={styles.compactCard}
      onPress={() => {
        if (Date.now() - lastCompactMapGestureAtRef.current < MAP_PRESS_SUPPRESSION_WINDOW_MS) {
          return;
        }

        onPress?.();
      }}
    >
      <View style={styles.compactImageWrap}>
        {photos[0] ? (
          <Image source={{ uri: photos[0] }} style={StyleSheet.absoluteFillObject} />
        ) : (
          <MiniMapPreview
            places={mapMarkers}
            height={160}
            interactive
            onMapGesture={() => {
              lastCompactMapGestureAtRef.current = Date.now();
            }}
          />
        )}
      </View>
      <View style={styles.compactBody}>
        <ExpandableText
          text={place.name}
          collapsedLines={1}
          textStyle={styles.compactTitle}
          showIndicator={false}
        />
        {place.notes ? (
          <ExpandableText text={place.notes} collapsedLines={1} textStyle={styles.compactDescription} />
        ) : null}
        {placeTimestampLabels.length > 0 ? (
          <View style={styles.compactTimestampBlock}>
            {placeTimestampLabels.map((label) => (
              <Text key={label} style={styles.compactTimestampText} numberOfLines={1}>
                {label}
              </Text>
            ))}
          </View>
        ) : null}
        {place.rating ? (
          <View style={styles.ratingRow}>
            <Star size={12} color={colors.warning} fill={colors.warning} />
            <Text style={styles.ratingText}>{place.rating}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
