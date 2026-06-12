import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { Crosshair, Star } from 'lucide-react-native';

import type { Place } from '@/mobile/app/data/contracts/entities';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import {
  MINI_MAP_RESET_LONG_PRESS_MS,
  useMiniMapInteraction,
} from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
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
  const handledLongPressRef = React.useRef(false);
  const hasMiniMap = !photos[0];
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(`${place.id}:${hasMiniMap ? 'map' : 'photo'}`);

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
          <AppImage
            uri={photos[0]}
            style={styles.compactImageWrap}
            accessibilityLabel={`${place.name} fotografi`}
          />
        ) : (
          <MiniMapPreview
            places={mapMarkers}
            height={160}
            interactive={isMapInteractive}
            instanceId={mapFocusKey}
            focusIndex={0}
            focusTrigger={mapFocusKey}
            onMapGesture={() => {
              lastCompactMapGestureAtRef.current = Date.now();
            }}
          />
        )}
        {hasMiniMap ? <MiniMapInteractionHint visible={showInteractionHint} /> : null}
      </View>
      <View style={styles.compactBody}>
        <View style={styles.compactTitleRow}>
          <View style={styles.compactTitleContent}>
            <ExpandableText
              text={place.name}
              collapsedLines={1}
              textStyle={styles.compactTitle}
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
                styles.focusActionButton,
                isMapInteractive ? styles.focusActionButtonActive : null,
              ]}
            >
              <Crosshair color={colors.primary} size={14} />
            </Pressable>
          ) : null}
        </View>
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
