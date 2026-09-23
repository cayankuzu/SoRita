import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Copy, Lock, MapPin, Play } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { ListCoverFallback } from '@/mobile/app/shared/components/media/ListCoverFallback';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';
import { buildStaticMapUrl } from '@/mobile/app/shared/utils/staticMapPreview';

// A static map is requested at a fixed size and scaled into any tile, so one
// cached image serves every grid width.
const STATIC_MAP_SIZE = 240;

type MosaicTileFrameProps = {
  accessibilityLabel: string;
  children: React.ReactNode;
  corner?: React.ReactNode;
  onPress: () => void;
  onPressIn?: () => void;
  title?: string;
};

/**
 * A square cell of an Instagram-style grid: the picture fills it, a name
 * sits on a soft fade at the bottom, and one small mark in the corner says
 * what kind of thing it is. No borders, no card chrome.
 */
function MosaicTileFrame({
  accessibilityLabel,
  children,
  corner,
  onPress,
  onPressIn,
  title,
}: MosaicTileFrameProps) {
  return (
    <InstantPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      style={styles.tile}
    >
      {children}
      {title ? (
        <View pointerEvents="none" style={styles.caption}>
          <Svg preserveAspectRatio="none" style={StyleSheet.absoluteFill} viewBox="0 0 1 1">
            <Defs>
              <LinearGradient id="mosaic-caption" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={colors.imageInk} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.imageInk} stopOpacity={0.72} />
              </LinearGradient>
            </Defs>
            <Rect fill="url(#mosaic-caption)" height="1" width="1" x="0" y="0" />
          </Svg>
          <AppText numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
        </View>
      ) : null}
      {corner ? (
        <View pointerEvents="none" style={styles.corner}>
          {corner}
        </View>
      ) : null}
    </InstantPressable>
  );
}

type ListMosaicTileProps = {
  list: PlaceList;
  onPress: () => void;
  onPressIn?: () => void;
  showPrivacyBadge?: boolean;
};

/** A list as its cover, or its first place photo, or its designed fallback. */
export const ListMosaicTile = React.memo(function ListMosaicTile({
  list,
  onPress,
  onPressIn,
  showPrivacyBadge = false,
}: ListMosaicTileProps) {
  const [coverFailed, setCoverFailed] = React.useState(false);
  const firstPlaceMedia = React.useMemo(() => {
    for (const place of list.places) {
      const media = getPlaceMedia(place)[0];
      if (media) return media;
    }
    return undefined;
  }, [list.places]);
  const placeCount = list.placeCount ?? list.places.length;
  const cover = list.coverImage && !coverFailed ? list.coverImage : null;

  return (
    <MosaicTileFrame
      accessibilityLabel={`${list.name}, ${tr.cards.placesCount(placeCount)}`}
      corner={
        showPrivacyBadge && !list.isPublic ? (
          <Lock color={colors.onPrimary} size={iconSize.sm} />
        ) : null
      }
      onPress={onPress}
      onPressIn={onPressIn}
      title={list.name}
    >
      {cover ? (
        <AppImage onError={() => setCoverFailed(true)} style={styles.media} uri={cover} />
      ) : firstPlaceMedia ? (
        <MediaThumbnailView
          fallbackToVideoPreview={false}
          item={firstPlaceMedia}
          showDuration={false}
          showPlayOverlay={false}
          style={styles.media}
        />
      ) : (
        <ListCoverFallback emoji={list.emoji || tr.placeEditor.defaultEmoji} seed={list.id} />
      )}
    </MosaicTileFrame>
  );
});

type PlaceMosaicTileProps = {
  markerColor?: string;
  onPress: () => void;
  onPressIn?: () => void;
  place: Place;
};

/** A place as its first photo or video, or a map of where it is. */
export const PlaceMosaicTile = React.memo(function PlaceMosaicTile({
  markerColor,
  onPress,
  onPressIn,
  place,
}: PlaceMosaicTileProps) {
  const media = React.useMemo(() => getPlaceMedia(place), [place]);
  const primaryMedia = media[0];
  const mapUrl = React.useMemo(
    () =>
      primaryMedia
        ? null
        : buildStaticMapUrl(
            [{ lat: place.lat, lng: place.lng, markerColor, name: place.name }],
            STATIC_MAP_SIZE,
            STATIC_MAP_SIZE,
          ),
    [markerColor, place.lat, place.lng, place.name, primaryMedia],
  );
  const corner = primaryMedia?.type === 'video'
    ? <Play color={colors.onPrimary} fill={colors.onPrimary} size={iconSize.sm} />
    : media.length > 1
      ? <Copy color={colors.onPrimary} size={iconSize.sm} />
      : null;

  return (
    <MosaicTileFrame
      accessibilityLabel={
        media.length > 0 ? tr.placeEditor.placePhotoLabel(place.name) : place.name
      }
      corner={corner}
      onPress={onPress}
      onPressIn={onPressIn}
      title={place.name}
    >
      {primaryMedia ? (
        <MediaThumbnailView
          fallbackToVideoPreview={false}
          item={primaryMedia}
          showDuration={false}
          showPlayOverlay={false}
          style={styles.media}
        />
      ) : mapUrl ? (
        <AppImage style={styles.media} uri={mapUrl} />
      ) : (
        <View style={[styles.media, styles.mapFallback]}>
          <MapPin color={colors.textSoft} size={iconSize.lg} />
        </View>
      )}
    </MosaicTileFrame>
  );
});

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    width: '100%',
  },
  media: {
    height: '100%',
    width: '100%',
  },
  mapFallback: {
    alignItems: 'center',
    backgroundColor: colors.mapBackground,
    justifyContent: 'center',
  },
  caption: {
    bottom: 0,
    left: 0,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    position: 'absolute',
    right: 0,
  },
  title: textStyle('metadataText', colors.onPrimary),
  corner: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
  },
});
