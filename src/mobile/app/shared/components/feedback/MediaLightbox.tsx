import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Download, MoreHorizontal, Play, Trash2, X } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceMedia } from '@/mobile/app/contracts/placeMedia';
import { saveUriToGallery } from '@/mobile/app/platform/media/gallery';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import {
  ActionMenuSheet,
  type ActionMenuSheetItem,
} from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { getLightboxPositionLabel } from '@/mobile/app/shared/components/feedback/lightboxAccessibility';
import { useLightboxAnnouncements } from '@/mobile/app/shared/components/feedback/useLightboxAnnouncements';
import { VideoPreview } from '@/mobile/app/shared/components/media/VideoPreview';
import { ZoomableView } from '@/mobile/app/shared/components/media/ZoomableView';
import { AppImage, prefetchAppImages } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText, type AppTextRef } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { triggerHaptic } from '@/mobile/app/shared/hooks/useHaptic';
import { useSystemBarMode } from '@/mobile/app/shared/components/chrome/AppSystemBars';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  controlSize,
  fontWeight,
  iconSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import {
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import { formatPlaceMediaDuration } from '@/mobile/app/shared/utils/placeMedia';
import { AppModal } from '@/mobile/app/shared/components/feedback/AppModal';

type MediaLightboxProps = {
  allowDownload?: boolean;
  initialIndex?: number;
  items: PlaceMedia[];
  onClose: () => void;
  onRemoveItem?: (index: number) => Promise<void> | void;
};

type VisibleMediaEntry = {
  item: PlaceMedia;
  sourceIndex: number;
};

const LIGHTBOX_HORIZONTAL_PADDING = 16;
const LIGHTBOX_TOP_BAR_HEIGHT = 84;
const DELETE_MEDIA_CONFIRMATION = {
  description: tr.common.mediaRemoveDescription,
  title: tr.common.mediaRemoveTitle,
} as const;

// The card already shows the thumbnail, so the viewer shows it at once and
// swaps in the full photo when it arrives, instead of five seconds of black.
// Private media resolves through AppImage and cannot be a placeholder.
function getThumbnailPlaceholder(item: PlaceMedia) {
  const { thumbnailUrl, url } = item;
  return thumbnailUrl && thumbnailUrl !== url && /^https?:///.test(thumbnailUrl)
    ? { uri: thumbnailUrl }
    : undefined;
}

function MediaLightboxPage({
  isActive,
  item,
  onZoomChange,
  pageHeight,
  pageWidth,
  positionLabel,
  shouldPrepareVideo,
}: {
  isActive: boolean;
  item: PlaceMedia;
  onZoomChange?: (zoomed: boolean) => void;
  pageHeight: number;
  pageWidth: number;
  positionLabel: string;
  shouldPrepareVideo: boolean;
}) {
  return (
    <View style={[styles.mediaPage, { height: pageHeight, width: pageWidth }]}>
      <View style={styles.mediaFrame}>
        {item.type === 'video' && shouldPrepareVideo ? (
          <VideoPreview
            uri={item.url}
            posterUri={item.thumbnailUrl}
            durationLabel={formatPlaceMediaDuration(item.durationMs)}
            nativeControls={isActive}
            showPlayOverlay={!isActive}
            style={styles.video}
            contentFit="contain"
          />
        ) : item.type === 'video' ? (
          <AppImage
            uri={item.thumbnailUrl}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={`${tr.common.videoPreview}. ${positionLabel}`}
            backgroundColor="transparent"
            priority={isActive ? 'high' : 'normal'}
            fallback={
              <View style={styles.videoPosterFallback}>
                <Play color={colors.onPrimary} fill={colors.onPrimary} size={iconSize.md} />
              </View>
            }
          />
        ) : (
          <ZoomableView active={isActive} onZoomChange={onZoomChange}>
            <AppImage
              uri={item.url}
              placeholder={getThumbnailPlaceholder(item)}
              showLoader={!getThumbnailPlaceholder(item)}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={`${tr.common.enlargedMedia}. ${positionLabel}`}
              backgroundColor="transparent"
              priority={isActive ? 'high' : 'normal'}
            />
          </ZoomableView>
        )}
      </View>
    </View>
  );
}

function useMediaLightboxLifecycle({
  currentIndex,
  flatListKey,
  menuItemCount,
  menuVisible,
  pendingRemoveIndex,
  positionLabel,
  setCurrentIndex,
  setMenuVisible,
  setPendingRemoveIndex,
  startIndex,
  titleRef,
  visibleItems,
}: {
  currentIndex: number;
  flatListKey: string;
  menuItemCount: number;
  menuVisible: boolean;
  pendingRemoveIndex: number | null;
  positionLabel: string;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  setMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingRemoveIndex: React.Dispatch<React.SetStateAction<number | null>>;
  startIndex: number;
  titleRef: React.RefObject<AppTextRef | null>;
  visibleItems: VisibleMediaEntry[];
}) {
  useLightboxAnnouncements({
    currentIndex,
    flatListKey,
    itemCount: visibleItems.length,
    positionLabel,
    setCurrentIndex,
    startIndex,
    suppressFocus: menuVisible || pendingRemoveIndex != null,
    titleRef,
  });

  React.useEffect(() => {
    const nearbyMediaUris = visibleItems
      .slice(Math.max(0, currentIndex - 1), currentIndex + 3)
      .map(({ item }) => item.type === 'video' ? item.thumbnailUrl : item.url);

    void prefetchAppImages(nearbyMediaUris);
  }, [currentIndex, visibleItems]);

  React.useEffect(() => {
    if (menuItemCount === 0) {
      setMenuVisible(false);
    }
  }, [menuItemCount, setMenuVisible]);

  React.useEffect(() => {
    if (visibleItems.length === 0) {
      setPendingRemoveIndex(null);
    }
  }, [setPendingRemoveIndex, visibleItems.length]);
}

export function MediaLightbox({
  allowDownload = false,
  initialIndex = 0,
  items,
  onClose,
  onRemoveItem,
}: MediaLightboxProps) {
  const animationType = useModalAnimationType('fade');
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const titleRef = React.useRef<AppTextRef | null>(null);
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

  // Fullscreen media sits on a near-black backdrop. Without this the system
  // bars keep their light-surface treatment and the clock and battery icons
  // are drawn dark-on-dark.
  useSystemBarMode('media', visibleItems.length > 0);

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
  // While a photo is zoomed, one finger moves around it instead of paging.
  const [photoZoomed, setPhotoZoomed] = React.useState(false);
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
  const currentItemTypeLabel =
    currentItem?.type === 'video' ? tr.common.mediaVideo : tr.common.mediaPhoto;
  const positionLabel = getLightboxPositionLabel(
    currentItemTypeLabel,
    currentIndex,
    visibleItems.length,
  );

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
        renderIcon: (color) => <Download color={color} size={iconSize.sm} />,
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
        renderIcon: (color) => <Trash2 color={color} size={iconSize.sm} />,
        onPress: () => {
          triggerHaptic('medium');
          setMenuVisible(false);
          setPendingRemoveIndex(currentEntry.sourceIndex);
        },
      });
    }

    return nextItems;
  }, [allowDownload, currentEntry, currentItem, handleDownloadCurrent, onRemoveItem]);

  useMediaLightboxLifecycle({
    currentIndex,
    flatListKey,
    menuItemCount: menuItems.length,
    menuVisible,
    pendingRemoveIndex,
    positionLabel,
    setCurrentIndex,
    setMenuVisible,
    setPendingRemoveIndex,
    startIndex,
    titleRef,
    visibleItems,
  });

  return (
    <AppModal
      animationType={animationType}
      onRequestClose={handleClose}
      visible={visibleItems.length > 0}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={handleClose}
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <View style={[styles.topBar, { width: pageWidth }]}>
          <IconButton
            accessibilityLabel={tr.common.close}
            style={styles.topActionButton}
            onPress={handleClose}
            variant="inverse"
          >
            <X color={colors.onPrimary} size={iconSize.md} />
          </IconButton>

          <View style={styles.topBarCopy}>
            <AppText
              ref={titleRef}
              accessibilityLabel={`${tr.common.previewTitle}. ${positionLabel}`}
              accessibilityRole="header"
              style={styles.topBarTitle}
            >
              {tr.common.previewTitle}
            </AppText>
            <AppText accessibilityLiveRegion="polite" style={styles.topBarSubtitle}>
              {positionLabel}
            </AppText>
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
              <MoreHorizontal color={colors.onPrimary} size={iconSize.md} />
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
              scrollEnabled={!photoZoomed}
              pagingEnabled
              disableIntervalMomentum
              directionalLockEnabled
              nestedScrollEnabled
              decelerationRate="fast"
              initialScrollIndex={startIndex}
              initialNumToRender={Math.min(3, visibleItems.length)}
              maxToRenderPerBatch={2}
              windowSize={3}
              getItemLayout={(_, index) => ({
                index,
                length: pageWidth,
                offset: pageWidth * index,
              })}
              // `sourceIndex` already identifies the entry, so the render index
              // added nothing but instability to the key.
              keyExtractor={(entry) =>
                `${entry.item.url}-${entry.item.type}-${entry.sourceIndex}`
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
                  onZoomChange={index === currentIndex ? setPhotoZoomed : undefined}
                  pageHeight={pageHeight}
                  pageWidth={pageWidth}
                  positionLabel={getLightboxPositionLabel(
                    item.item.type === 'video' ? tr.common.mediaVideo : tr.common.mediaPhoto,
                    index,
                    visibleItems.length,
                  )}
                  shouldPrepareVideo={
                    item.item.type === 'video' && Math.abs(index - currentIndex) <= 1
                  }
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
          returnFocusRef={titleRef}
        />
        {pendingRemoveIndex != null && onRemoveItem ? (
          <ConfirmActionModal
            visible
            title={DELETE_MEDIA_CONFIRMATION.title}
            description={DELETE_MEDIA_CONFIRMATION.description}
            confirmLabel={tr.common.delete}
            confirmVariant="danger"
            onClose={() => setPendingRemoveIndex(null)}
            returnFocusRef={titleRef}
            onConfirm={() => onRemoveItem(pendingRemoveIndex)}
          />
        ) : null}
      </View>
      </GestureHandlerRootView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Near-black, as the light status-bar icons set for media expect; the
    // 40% overlay left the screen behind readable and the clock unreadable.
    backgroundColor: colors.scrim,
    padding: LIGHTBOX_HORIZONTAL_PADDING,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  topActionButton: {
    width: controlSize.default,
    height: controlSize.default,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
    borderWidth: 1,
    borderColor: colors.controlsBorder,
  },
  topActionSpacer: {
    width: controlSize.default,
    height: controlSize.default,
  },
  topBarCopy: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.darkOverlay,
    borderWidth: 1,
    borderColor: colors.controlsBorder,
  },
  topBarTitle: textStyle('bodyText', colors.onPrimary, fontWeight.strong),
  topBarSubtitle: {
    marginTop: spacing.xs,
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.onDarkMuted,
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
    paddingVertical: spacing.xs,
  },
  mediaFrame: {
    flex: 1,
    width: '100%',
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.deepBackground,
    borderWidth: 1,
    borderColor: colors.controlsBorder,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.deepBackground,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.deepBackground,
  },
  videoPosterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.deepBackground,
  },
});
