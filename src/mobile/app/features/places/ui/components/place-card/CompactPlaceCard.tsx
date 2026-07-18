import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { ChevronRight, Crosshair, Star } from 'lucide-react-native';

import type { Place, PlaceMedia } from '@/mobile/app/data/contracts/entities';
import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import {
  MINI_MAP_RESET_LONG_PRESS_MS,
  useMiniMapInteraction,
} from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { formatLocationPlaceCardsCount } from '@/mobile/app/shared/utils/format';

const MAP_PRESS_SUPPRESSION_WINDOW_MS = 320;

type CompactMapMarker = {
  lat: number;
  lng: number;
  name: string;
  markerColor: string;
};

type CompactPlaceCardProps = {
  locationPlaceCardsCount?: number;
  media: PlaceMedia[];
  mapMarkers: CompactMapMarker[];
  place: Place;
  placeTimestampLabels: string[];
  onPlaceNamePress?: () => void;
  onPress?: () => void;
};

export function CompactPlaceCard({
  locationPlaceCardsCount,
  media,
  mapMarkers,
  place,
  placeTimestampLabels,
  onPlaceNamePress,
  onPress,
}: CompactPlaceCardProps) {
  const [isPlaceNameExpanded, setIsPlaceNameExpanded] = React.useState(false);
  const [isPlaceNameTruncated, setIsPlaceNameTruncated] = React.useState(false);
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

  React.useEffect(() => {
    setIsPlaceNameExpanded(false);
    setIsPlaceNameTruncated(false);
  }, [onPlaceNamePress, place.id, place.name]);

  const handlePlaceNamePress = () => {
    if (!onPlaceNamePress) {
      return;
    }

    if (isPlaceNameTruncated && !isPlaceNameExpanded) {
      setIsPlaceNameExpanded(true);
      return;
    }

    setIsPlaceNameExpanded(false);
    onPlaceNamePress();
  };

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
          <MediaThumbnailView
            item={primaryMedia}
            style={styles.compactImageWrap}
            accessibilityLabel={`${place.name} fotografi`}
            fallbackToVideoPreview={false}
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
          <Pressable
            accessibilityRole={onPlaceNamePress ? 'button' : undefined}
            disabled={!onPlaceNamePress}
            hitSlop={6}
            onPress={(event) => {
              event.stopPropagation();
              handlePlaceNamePress();
            }}
            style={({ pressed }) => [
              styles.contentTitleButton,
              onPlaceNamePress ? styles.contentTitleButtonInteractive : null,
              pressed && onPlaceNamePress ? styles.contentTitleButtonPressed : null,
            ]}
          >
            <View style={styles.contentTitleStack}>
              <Text
                onTextLayout={(event) => {
                  const nextIsTruncated = event.nativeEvent.lines.length > 1;
                  setIsPlaceNameTruncated((current) =>
                    current === nextIsTruncated ? current : nextIsTruncated,
                  );
                }}
                pointerEvents="none"
                style={[
                  styles.compactTitle,
                  onPlaceNamePress ? styles.compactTitleLink : null,
                  styles.contentTitleMeasureText,
                ]}
              >
                {place.name}
              </Text>
              <View style={styles.contentTitleInline}>
                <Text
                  numberOfLines={isPlaceNameExpanded ? undefined : 1}
                  style={[styles.compactTitle, onPlaceNamePress ? styles.compactTitleLink : null]}
                >
                  {place.name}
                </Text>
                {onPlaceNamePress ? (
                  <ChevronRight
                    color={colors.primary}
                    size={13}
                    strokeWidth={2.3}
                    style={styles.contentTitleChevron}
                  />
                ) : null}
              </View>
              {locationPlaceCardsCount != null ? (
                <Text style={styles.compactTitleMeta}>
                  {formatLocationPlaceCardsCount(locationPlaceCardsCount)}
                </Text>
              ) : null}
            </View>
          </Pressable>
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
          <ExpandableText
            text={place.notes}
            collapsedLines={1}
            preserveLineBreaks
            maxCollapsedLinesWhenPreservingBreaks={3}
            textStyle={styles.compactDescription}
          />
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
