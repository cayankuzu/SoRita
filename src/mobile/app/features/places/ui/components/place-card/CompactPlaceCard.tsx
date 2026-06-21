import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { Crosshair, Star } from 'lucide-react-native';

import type { Place, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import {
  MINI_MAP_RESET_LONG_PRESS_MS,
  useMiniMapInteraction,
} from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { VideoPreview } from '@/mobile/app/shared/components/media/VideoPreview';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

type CompactMapMarker = {
  lat: number;
  lng: number;
  name: string;
  markerColor: string;
};

type CompactPlaceCardProps = {
  media: PlaceMedia[];
  mapMarkers: CompactMapMarker[];
  place: Place;
  placeTimestampLabels: string[];
  onPress?: () => void;
};

export function CompactPlaceCard({
  media,
  mapMarkers,
  place,
  placeTimestampLabels,
  onPress,
}: CompactPlaceCardProps) {
  const lastCompactMapGestureAtRef = React.useRef(0);
  const handledLongPressRef = React.useRef(false);
  const primaryMedia = media[0];
  const hasMiniMap = !primaryMedia;
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(`${place.id}:${hasMiniMap ? 'map' : primaryMedia.type}`);

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
        {primaryMedia ? (
          primaryMedia.type === 'video' ? (
            <VideoPreview uri={primaryMedia.url} muted style={styles.compactImageWrap} />
          ) : (
            <AppImage
              uri={primaryMedia.url}
              style={styles.compactImageWrap}
              accessibilityLabel={`${place.name} fotoğrafı`}
            />
          )
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
              accessibilityLabel={tr.cards.focusMiniMap}
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
