import React from 'react';
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Download, MoreHorizontal, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionMenuSheet,
  type ActionMenuSheetItem,
} from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { saveUriToGallery } from '@/mobile/app/platform/media/gallery';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

type ImageLightboxProps = {
  allowDownload?: boolean;
  initialIndex?: number;
  onClose: () => void;
  uri?: string | null;
  uris?: string[];
};

const LIGHTBOX_HORIZONTAL_PADDING = 16;
const LIGHTBOX_TOP_BAR_HEIGHT = 84;

export function ImageLightbox({
  allowDownload = false,
  initialIndex = 0,
  onClose,
  uri = null,
  uris,
}: ImageLightboxProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const imageUris = React.useMemo(() => {
    const nextUris = (uris || []).filter(Boolean);

    if (nextUris.length > 0) {
      return nextUris;
    }

    return uri ? [uri] : [];
  }, [uri, uris]);
  const startIndex = imageUris.length
    ? Math.min(Math.max(initialIndex, 0), imageUris.length - 1)
    : 0;
  const [currentIndex, setCurrentIndex] = React.useState(startIndex);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const flatListKey = React.useMemo(
    () => `${imageUris.length}:${startIndex}:${imageUris[startIndex] || 'empty'}`,
    [imageUris, startIndex],
  );
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 16,
    bottomSpacing: 16,
    minBottomPadding: Platform.OS === 'android' ? 24 : 16,
  });
  const pageWidth = Math.max(windowWidth - LIGHTBOX_HORIZONTAL_PADDING * 2, 1);
  const pageHeight = Math.max(
    windowHeight - paddingTop - paddingBottom - LIGHTBOX_TOP_BAR_HEIGHT,
    1,
  );
  const currentUri = imageUris[currentIndex] ?? imageUris[startIndex] ?? null;

  const handleDownloadCurrent = React.useCallback(async () => {
    if (!currentUri) {
      return;
    }

    const saved = await saveUriToGallery({ uri: currentUri });

    showToast(saved ? tr.common.gallerySaved : tr.common.gallerySaveFailed, saved ? 'success' : 'error');
  }, [currentUri]);

  const menuItems = React.useMemo<readonly ActionMenuSheetItem[]>(
    () =>
      allowDownload && currentUri
        ? [
            {
              key: 'download-image',
              label: tr.common.download,
              renderIcon: (color) => <Download color={color} size={16} />,
              onPress: () => {
                setMenuVisible(false);
                void handleDownloadCurrent();
              },
            },
          ]
        : [],
    [allowDownload, currentUri, handleDownloadCurrent],
  );

  React.useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  React.useEffect(() => {
    if (menuItems.length === 0) {
      setMenuVisible(false);
    }
  }, [menuItems.length]);

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={imageUris.length > 0}
      animationType="fade"
      transparent
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <View style={[styles.topBar, { width: pageWidth }]}>
          <IconButton
            accessibilityLabel={tr.common.close}
            onPress={onClose}
            style={styles.topActionButton}
            variant="inverse"
          >
            <X color={colors.onPrimary} size={20} />
          </IconButton>

          <View style={styles.topBarCopy}>
            <Text style={styles.topBarTitle}>{tr.common.previewTitle}</Text>
            <Text style={styles.topBarSubtitle}>
              {imageUris.length > 1
                ? `${tr.placeEditor.photo} ${currentIndex + 1}/${imageUris.length}`
                : tr.placeEditor.photo}
            </Text>
          </View>

          {menuItems.length > 0 ? (
            <IconButton
              accessibilityLabel={tr.common.contentActionsTitle}
              onPress={() => setMenuVisible(true)}
              style={styles.topActionButton}
              variant="inverse"
            >
              <MoreHorizontal color={colors.onPrimary} size={20} />
            </IconButton>
          ) : (
            <View style={styles.topActionSpacer} />
          )}
        </View>

        {imageUris.length > 0 ? (
          <View style={[styles.carouselViewport, { height: pageHeight, width: pageWidth }]}>
            <FlatList
              key={flatListKey}
              data={imageUris}
              horizontal
              pagingEnabled
              disableIntervalMomentum
              directionalLockEnabled
              nestedScrollEnabled
              decelerationRate="fast"
              initialScrollIndex={startIndex}
              getItemLayout={(_, index) => ({
                index,
                length: pageWidth,
                offset: pageWidth * index,
              })}
              keyExtractor={(item, index) => `${item}-${index}`}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                setCurrentIndex(Math.min(Math.max(nextIndex, 0), imageUris.length - 1));
              }}
              renderItem={({ item, index }) => (
                <View style={[styles.imagePage, { width: pageWidth }]}>
                  <AppImage
                    uri={item}
                    style={styles.image}
                    resizeMode="contain"
                    accessibilityLabel={tr.common.enlargedPhotoLabel(index + 1)}
                    backgroundColor="transparent"
                  />
                </View>
              )}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              style={styles.carousel}
              onScrollToIndexFailed={() => {
                setCurrentIndex(startIndex);
              }}
            />
          </View>
        ) : null}

        <ActionMenuSheet
          visible={menuVisible && menuItems.length > 0}
          title={tr.common.contentActionsTitle}
          items={menuItems}
          onClose={() => setMenuVisible(false)}
        />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  topActionButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.controlsOverlay,
    borderWidth: 1,
    borderColor: colors.controlsBorder,
  },
  topActionSpacer: {
    width: 44,
    height: 44,
  },
  topBarCopy: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.controlsOverlay,
    borderWidth: 1,
    borderColor: colors.controlsBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  topBarTitle: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  topBarSubtitle: {
    color: colors.onDarkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  carouselViewport: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  carousel: {
    flex: 1,
  },
  imagePage: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
