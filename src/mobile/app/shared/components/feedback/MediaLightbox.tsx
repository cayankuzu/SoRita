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
import { Download, MoreHorizontal, Play, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceMedia } from '@/mobile/app/contracts/placeMedia';
import { saveUriToGallery } from '@/mobile/app/platform/media/gallery';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import {
  ActionMenuSheet,
  type ActionMenuSheetItem,
} from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { VideoPreview } from '@/mobile/app/shared/components/media/VideoPreview';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { triggerHaptic } from '@/mobile/app/shared/hooks/useHaptic';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import { formatPlaceMediaDuration } from '@/mobile/app/shared/utils/placeMedia';

type MediaLightboxProps = {
  allowDownload?: boolean;
  initialIndex?: number;
  items: PlaceMedia[];
  onClose: () => void;
  onRemoveItem?: (index: number) => void;
};

type VisibleMediaEntry = {
  item: PlaceMedia;
  sourceIndex: number;
};

const LIGHTBOX_HORIZONTAL_PADDING = 16;
const LIGHTBOX_TOP_BAR_HEIGHT = 84;
const DELETE_MEDIA_CONFIRMATION = {
  description: 'Secili medya bu karttan kaldirilacak.',
  title: 'Medya silinsin mi?',
} as const;

function MediaLightboxPage({
  isActive,
  item,
  pageHeight,
  pageWidth,
}: {
  isActive: boolean;
  item: PlaceMedia;
  pageHeight: number;
  pageWidth: number;
}) {
  return (
    <View style={[styles.mediaPage, { height: pageHeight, width: pageWidth }]}>
      <View style={styles.mediaFrame}>
        {item.type === 'video' && isActive ? (
          <VideoPreview
            uri={item.url}
            durationLabel={formatPlaceMediaDuration(item.durationMs)}
            nativeControls
            showPlayOverlay={false}
            style={styles.video}
            contentFit="contain"
          />
        ) : item.type === 'video' ? (
          <AppImage
            uri={item.thumbnailUrl}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Video onizleme"
            backgroundColor="transparent"
            fallback={
              <View style={styles.videoPosterFallback}>
                <Play color={colors.onPrimary} fill={colors.onPrimary} size={24} />
              </View>
            }
          />
        ) : (
          <AppImage
            uri={item.url}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Buyutulmus medya"
            backgroundColor="transparent"
          />
        )}
      </View>
    </View>
  );
}

export function MediaLightbox({
  allowDownload = false,
  initialIndex = 0,
  items,
  onClose,
  onRemoveItem,
}: MediaLightboxProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const flatListRef = React.useRef<FlatList<VisibleMediaEntry> | null>(null);
  const visibleItems = React.useMemo(
    () =>
      items.reduce<VisibleMediaEntry[]>((accumulator, item, sourceIndex) => {
        if (item?.url) {
          accumulator.push({ item, sourceIndex });
        }

        return accumulator;
      }, []),
    [items],
  );
  const startIndex = React.useMemo(() => {
    if (visibleItems.length === 0) {
      return 0;
    }

    const matchedIndex = visibleItems.findIndex((entry) => entry.sourceIndex === initialIndex);
    if (matchedIndex >= 0) {
      return matchedIndex;
    }

    return Math.min(Math.max(initialIndex, 0), visibleItems.length - 1);
  }, [initialIndex, visibleItems]);
  const [currentIndex, setCurrentIndex] = React.useState(startIndex);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = React.useState<number | null>(null);
  const flatListKey = React.useMemo(
    () => `${visibleItems.length}:${startIndex}:${visibleItems[startIndex]?.item.url || 'empty'}`,
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
    windowHeight - paddingTop - paddingBottom - LIGHTBOX_TOP_BAR_HEIGHT,
    1,
  );
  const currentEntry = visibleItems[currentIndex] ?? visibleItems[startIndex] ?? null;
  const currentItem = currentEntry?.item ?? null;
  const currentItemTypeLabel = currentItem?.type === 'video' ? 'Video' : 'Fotograf';

  const handleClose = React.useCallback(() => {
    triggerHaptic('light');
    onClose();
  }, [onClose]);

  const handleDownloadCurrent = React.useCallback(async () => {
    if (!currentItem) {
      return;
    }

    triggerHaptic('medium');
    const saved = await saveUriToGallery({
      fileName: currentItem.fileName,
      mimeType: currentItem.mimeType,
      uri: currentItem.url,
    });

    showToast(
      saved ? tr.common.gallerySaved : tr.common.gallerySaveFailed,
      saved ? 'success' : 'error',
    );
  }, [currentItem]);

  const menuItems = React.useMemo<readonly ActionMenuSheetItem[]>(() => {
    const nextItems: ActionMenuSheetItem[] = [];

    if (allowDownload && currentItem) {
      nextItems.push({
        key: 'download-media',
        label: tr.common.download,
        renderIcon: (color) => <Download color={color} size={16} />,
        onPress: () => {
          setMenuVisible(false);
          void handleDownloadCurrent();
        },
      });
    }

    if (onRemoveItem && currentEntry) {
      nextItems.push({
        key: 'delete-media',
        label: tr.common.delete,
        tone: 'danger',
        renderIcon: (color) => <Trash2 color={color} size={16} />,
        onPress: () => {
          triggerHaptic('medium');
          setMenuVisible(false);
          setPendingRemoveIndex(currentEntry.sourceIndex);
        },
      });
    }

    return nextItems;
  }, [allowDownload, currentEntry, currentItem, handleDownloadCurrent, onRemoveItem]);

  React.useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  React.useEffect(() => {
    if (menuItems.length === 0) {
      setMenuVisible(false);
    }
  }, [menuItems.length]);

  React.useEffect(() => {
    if (visibleItems.length === 0) {
      setPendingRemoveIndex(null);
    }
  }, [visibleItems.length]);

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visibleItems.length > 0}
      animationType="fade"
      transparent
      hardwareAccelerated
      onRequestClose={handleClose}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <View style={[styles.topBar, { width: pageWidth }]}>
          <IconButton
            accessibilityLabel={tr.common.close}
            style={styles.topActionButton}
            onPress={handleClose}
            variant="inverse"
          >
            <X color={colors.onPrimary} size={20} />
          </IconButton>

          <View style={styles.topBarCopy}>
            <Text style={styles.topBarTitle}>{tr.common.previewTitle}</Text>
            <Text style={styles.topBarSubtitle}>
              {currentIndex + 1}/{visibleItems.length} {currentItemTypeLabel}
            </Text>
          </View>

          {menuItems.length > 0 ? (
            <IconButton
              accessibilityLabel={tr.common.contentActionsTitle}
              style={styles.topActionButton}
              onPress={() => {
                triggerHaptic('light');
                setMenuVisible(true);
              }}
              variant="inverse"
            >
              <MoreHorizontal color={colors.onPrimary} size={20} />
            </IconButton>
          ) : (
            <View style={styles.topActionSpacer} />
          )}
        </View>

        {visibleItems.length > 0 ? (
          <View style={[styles.carouselViewport, { height: pageHeight, width: pageWidth }]}>
            <FlatList
              ref={flatListRef}
              key={flatListKey}
              data={visibleItems}
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
              keyExtractor={(entry, index) =>
                `${entry.item.url}-${entry.item.type}-${entry.sourceIndex}-${index}`
              }
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                const clampedIndex = Math.min(Math.max(nextIndex, 0), visibleItems.length - 1);

                if (clampedIndex !== currentIndex) {
                  triggerHaptic('light');
                }

                setCurrentIndex(clampedIndex);
              }}
              renderItem={({ item, index }) => (
                <MediaLightboxPage
                  isActive={index === currentIndex}
                  item={item.item}
                  pageHeight={pageHeight}
                  pageWidth={pageWidth}
                />
              )}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              style={styles.carousel}
              onScrollToIndexFailed={() => {
                flatListRef.current?.scrollToOffset({
                  animated: false,
                  offset: pageWidth * startIndex,
                });
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
        {pendingRemoveIndex != null && onRemoveItem ? (
          <ConfirmActionModal
            visible
            title={DELETE_MEDIA_CONFIRMATION.title}
            description={DELETE_MEDIA_CONFIRMATION.description}
            confirmLabel={tr.common.delete}
            confirmVariant="danger"
            onClose={() => setPendingRemoveIndex(null)}
            onConfirm={() => {
              const nextIndex = pendingRemoveIndex;
              setPendingRemoveIndex(null);
              onRemoveItem(nextIndex);
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
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
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,10,19,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  topActionSpacer: {
    width: 44,
    height: 44,
  },
  topBarCopy: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(5,10,19,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  topBarSubtitle: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(233,240,255,0.72)',
  },
  carouselViewport: {
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
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#040811',
    borderWidth: 1,
    borderColor: colors.deepBorder,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#040811',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#040811',
  },
  videoPosterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#040811',
  },
});
