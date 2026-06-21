import React from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceMedia } from '@/mobile/app/data/contracts/entities';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { VideoPreview } from '@/mobile/app/shared/components/media/VideoPreview';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { formatPlaceMediaDuration } from '@/mobile/app/shared/utils/placeMedia';
import { getModalSafeAreaPadding } from '@/mobile/app/shared/utils/modalLayout';

type MediaLightboxProps = {
  initialIndex?: number;
  items: PlaceMedia[];
  onClose: () => void;
};

const LIGHTBOX_HORIZONTAL_PADDING = 16;

function MediaLightboxPage({
  item,
  pageHeight,
  pageWidth,
}: {
  item: PlaceMedia;
  pageHeight: number;
  pageWidth: number;
}) {
  return (
    <View style={[styles.mediaPage, { height: pageHeight, width: pageWidth }]}>
      <View style={styles.mediaFrame}>
        {item.type === 'video' ? (
          <VideoPreview
            uri={item.url}
            durationLabel={formatPlaceMediaDuration(item.durationMs)}
            nativeControls
            showPlayOverlay={false}
            style={styles.video}
            contentFit="contain"
          />
        ) : (
          <AppImage
            uri={item.url}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Büyütülmüş medya"
            backgroundColor="transparent"
          />
        )}
      </View>
    </View>
  );
}

export function MediaLightbox({
  initialIndex = 0,
  items,
  onClose,
}: MediaLightboxProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const visibleItems = React.useMemo(() => items.filter((item) => Boolean(item?.url)), [items]);
  const startIndex = visibleItems.length
    ? Math.min(Math.max(initialIndex, 0), visibleItems.length - 1)
    : 0;
  const [currentIndex, setCurrentIndex] = React.useState(startIndex);
  const flatListKey = React.useMemo(
    () => `${visibleItems.length}:${startIndex}:${visibleItems[startIndex]?.url || 'empty'}`,
    [visibleItems, startIndex],
  );
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: Platform.OS === 'android' ? 20 : 16,
    bottomSpacing: Platform.OS === 'android' ? 24 : 16,
    minTopPadding: Platform.OS === 'android' ? 24 : 16,
    minBottomPadding: Platform.OS === 'android' ? 48 : 16,
  });
  const pageWidth = Math.max(windowWidth - LIGHTBOX_HORIZONTAL_PADDING * 2, 1);
  const pageHeight = Math.max(
    windowHeight - paddingTop - paddingBottom - (Platform.OS === 'android' ? 40 : 28),
    1,
  );

  React.useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  return (
    <Modal
      visible={visibleItems.length > 0}
      animationType="fade"
      transparent
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <Pressable style={[styles.close, { top: paddingTop }]} onPress={onClose}>
          <X color={colors.onPrimary} size={20} />
        </Pressable>
        {visibleItems.length > 1 ? (
          <View style={[styles.counter, { top: paddingTop }]}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {visibleItems.length}
            </Text>
          </View>
        ) : null}
        {visibleItems.length > 0 ? (
          <View style={[styles.carouselViewport, { height: pageHeight, width: pageWidth }]}>
            <FlatList
              key={flatListKey}
              data={visibleItems}
              horizontal
              pagingEnabled
              initialScrollIndex={startIndex}
              getItemLayout={(_, index) => ({
                index,
                length: pageWidth,
                offset: pageWidth * index,
              })}
              keyExtractor={(item, index) => `${item.url}-${item.type}-${index}`}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                setCurrentIndex(Math.min(Math.max(nextIndex, 0), visibleItems.length - 1));
              }}
              renderItem={({ item }) => (
                <MediaLightboxPage item={item} pageHeight={pageHeight} pageWidth={pageWidth} />
              )}
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              onScrollToIndexFailed={() => {
                setCurrentIndex(startIndex);
              }}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.lightboxOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: LIGHTBOX_HORIZONTAL_PADDING,
  },
  close: {
    position: 'absolute',
    right: 24,
    zIndex: 2,
  },
  counter: {
    position: 'absolute',
    left: 24,
    zIndex: 2,
    borderRadius: 999,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  counterText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  carouselViewport: {
    flex: 1,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  carousel: {
    flex: 1,
  },
  mediaPage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  mediaFrame: {
    flex: 1,
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
