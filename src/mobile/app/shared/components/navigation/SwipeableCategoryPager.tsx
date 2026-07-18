import React from "react";
import {
  AccessibilityInfo,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  loadNativePagerView,
  type NativePagerViewHandle,
  type NativePagerViewOnPageScrollEvent,
  type NativePagerViewOnPageScrollStateChangedEvent,
  type NativePagerViewOnPageSelectedEvent,
} from "@/mobile/app/shared/components/navigation/pagerViewAdapter";

export type SwipeableCategoryPagerTab<TTab extends string> = {
  key: TTab;
  label: string;
};

type SwipeableCategoryPagerProps<TTab extends string> = {
  activeTab: TTab;
  keepAlive?: boolean;
  lazy?: boolean;
  layoutMode?: "content" | "fill";
  tabs: Array<SwipeableCategoryPagerTab<TTab>>;
  onPageProgressChange?: (pageOffset: number) => void;
  onTabChange: (tab: TTab) => void;
  onTabPreviewChange?: (tab: TTab) => void;
  renderPage: (tab: TTab, index: number, active: boolean) => React.ReactNode;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const PAGE_SELECTION_SYNC_THRESHOLD = 0.08;
const PROGRAMMATIC_SCROLL_GUARD_MS = 700;
const LAZY_RENDER_RADIUS = 2;

function clampPageIndex(index: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), total - 1);
}

export function clampPageProgress(pageOffset: number, total: number) {
  if (!Number.isFinite(pageOffset) || total <= 0) {
    return 0;
  }

  return Math.min(Math.max(pageOffset, 0), total - 1);
}

export function resolvePagedScrollIndex(
  pageOffset: number,
  currentIndex: number,
  total: number,
  threshold = PAGE_SELECTION_SYNC_THRESHOLD,
) {
  const delta = pageOffset - currentIndex;

  if (delta >= threshold) {
    return clampPageIndex(Math.ceil(pageOffset), total);
  }

  if (delta <= -threshold) {
    return clampPageIndex(Math.floor(pageOffset), total);
  }

  return clampPageIndex(currentIndex, total);
}

export function shouldRenderPagedItem(
  index: number,
  anchorIndex: number,
  keepAlive: boolean,
  lazy: boolean,
  radius = LAZY_RENDER_RADIUS,
) {
  if (keepAlive || !lazy) {
    return true;
  }

  return Math.abs(index - anchorIndex) <= radius;
}

type SharedPagerProps<TTab extends string> = Omit<
  SwipeableCategoryPagerProps<TTab>,
  "layoutMode"
> & {
  activeIndex: number;
  pageWidth: number;
};

function SwipeableContentPager<TTab extends string>({
  activeIndex,
  activeTab,
  keepAlive = true,
  lazy = false,
  onPageProgressChange,
  onTabChange,
  onTabPreviewChange,
  pageWidth,
  renderPage,
  scrollEnabled = true,
  style,
  tabs,
}: SharedPagerProps<TTab>) {
  const NativePagerView = React.useMemo(() => loadNativePagerView(), []);
  const nativePagerRef = React.useRef<NativePagerViewHandle | null>(null);
  const flatPagerRef = React.useRef<FlatList<SwipeableCategoryPagerTab<TTab>> | null>(
    null,
  );
  const currentPageRef = React.useRef(activeIndex);
  const previewPageRef = React.useRef(activeIndex);
  const didMountRef = React.useRef(false);
  const pageHeightsRef = React.useRef<Record<number, number>>({});
  const maxMeasuredHeightRef = React.useRef(0);
  const programmaticScrollRef = React.useRef(false);
  const programmaticScrollTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [contentPagerHeight, setContentPagerHeight] = React.useState<
    number | null
  >(null);
  const [renderWindowIndex, setRenderWindowIndex] = React.useState(activeIndex);

  const clearProgrammaticScrollTimer = React.useCallback(() => {
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
      programmaticScrollTimerRef.current = null;
    }
  }, []);

  const beginProgrammaticScrollGuard = React.useCallback(() => {
    clearProgrammaticScrollTimer();
    programmaticScrollRef.current = true;
    programmaticScrollTimerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
      programmaticScrollTimerRef.current = null;
    }, PROGRAMMATIC_SCROLL_GUARD_MS);
  }, [clearProgrammaticScrollTimer]);

  const endProgrammaticScrollGuard = React.useCallback(() => {
    clearProgrammaticScrollTimer();
    programmaticScrollRef.current = false;
  }, [clearProgrammaticScrollTimer]);

  React.useEffect(
    () => () => {
      clearProgrammaticScrollTimer();
    },
    [clearProgrammaticScrollTimer],
  );

  const announceTabChange = React.useCallback(
    (tabLabel: string, index: number) => {
      AccessibilityInfo.announceForAccessibility(
        `${tabLabel} sekmesi, ${index + 1}/${tabs.length}`,
      );
    },
    [tabs.length],
  );

  const emitPreviewIndex = React.useCallback(
    (nextIndex: number) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);

      if (previewPageRef.current === clampedIndex) {
        return;
      }

      const nextTab = tabs[clampedIndex];

      if (!nextTab) {
        return;
      }

      previewPageRef.current = clampedIndex;
      setRenderWindowIndex(clampedIndex);
      onTabPreviewChange?.(nextTab.key);
    },
    [onTabPreviewChange, tabs],
  );

  const emitPageProgress = React.useCallback(
    (pageOffset: number) => {
      onPageProgressChange?.(clampPageProgress(pageOffset, tabs.length));
    },
    [onPageProgressChange, tabs.length],
  );

  const updateContentPagerHeight = React.useCallback((nextHeight: number) => {
    if (nextHeight <= 0) {
      return;
    }

    maxMeasuredHeightRef.current = Math.max(maxMeasuredHeightRef.current, nextHeight);

    setContentPagerHeight((currentHeight) =>
      currentHeight &&
      Math.abs(currentHeight - maxMeasuredHeightRef.current) < 1
        ? currentHeight
        : maxMeasuredHeightRef.current,
    );
  }, []);

  const syncPreviewHeight = React.useCallback(
    (primaryIndex: number, secondaryIndex?: number) => {
      const primaryHeight = pageHeightsRef.current[primaryIndex] ?? 0;
      const secondaryHeight =
        secondaryIndex != null ? pageHeightsRef.current[secondaryIndex] ?? 0 : 0;
      const nextHeight = Math.max(
        maxMeasuredHeightRef.current,
        primaryHeight,
        secondaryHeight,
      );

      if (nextHeight > 0) {
        updateContentPagerHeight(nextHeight);
      }
    },
    [updateContentPagerHeight],
  );

  const settleTabIndex = React.useCallback(
    (nextIndex: number, announce = false) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);
      const nextTab = tabs[clampedIndex];

      if (!nextTab) {
        return;
      }

      currentPageRef.current = clampedIndex;
      emitPreviewIndex(clampedIndex);
      emitPageProgress(clampedIndex);
      syncPreviewHeight(clampedIndex);

      if (nextTab.key !== activeTab) {
        onTabChange(nextTab.key);
        if (announce) {
          announceTabChange(nextTab.label, clampedIndex);
        }
      }
    },
    [
      activeTab,
      announceTabChange,
      emitPageProgress,
      emitPreviewIndex,
      onTabChange,
      syncPreviewHeight,
      tabs,
    ],
  );

  React.useEffect(() => {
    if (currentPageRef.current === activeIndex) {
      emitPageProgress(activeIndex);
      syncPreviewHeight(activeIndex);
      return;
    }

    currentPageRef.current = activeIndex;
    previewPageRef.current = activeIndex;
    setRenderWindowIndex(activeIndex);
    emitPageProgress(activeIndex);
    onTabPreviewChange?.(tabs[activeIndex]?.key ?? activeTab);
    beginProgrammaticScrollGuard();
    const handle = requestAnimationFrame(() => {
      if (NativePagerView) {
        if (didMountRef.current) {
          nativePagerRef.current?.setPage(activeIndex);
        } else {
          nativePagerRef.current?.setPageWithoutAnimation(activeIndex);
        }
      } else {
        flatPagerRef.current?.scrollToIndex({
          animated: didMountRef.current,
          index: activeIndex,
        });
      }
      didMountRef.current = true;
      syncPreviewHeight(activeIndex);
    });
    return () => cancelAnimationFrame(handle);
  }, [
    NativePagerView,
    activeIndex,
    activeTab,
    beginProgrammaticScrollGuard,
    emitPageProgress,
    onTabPreviewChange,
    syncPreviewHeight,
    tabs,
  ]);

  const handleFlatScrollPageSettled = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settledIndex = clampPageIndex(
        Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        tabs.length,
      );

      if (programmaticScrollRef.current) {
        currentPageRef.current = settledIndex;
        previewPageRef.current = settledIndex;
        emitPageProgress(settledIndex);
        endProgrammaticScrollGuard();
        syncPreviewHeight(settledIndex);
        return;
      }

      settleTabIndex(settledIndex, true);
    },
    [
      endProgrammaticScrollGuard,
      emitPageProgress,
      pageWidth,
      settleTabIndex,
      syncPreviewHeight,
      tabs.length,
    ],
  );

  const handleFlatScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (programmaticScrollRef.current) {
        return;
      }

      const absolutePageOffset = event.nativeEvent.contentOffset.x / pageWidth;
      emitPageProgress(absolutePageOffset);
      const nextIndex = resolvePagedScrollIndex(
        absolutePageOffset,
        currentPageRef.current,
        tabs.length,
      );

      emitPreviewIndex(nextIndex);
      syncPreviewHeight(currentPageRef.current, nextIndex);
    },
    [emitPageProgress, emitPreviewIndex, pageWidth, syncPreviewHeight, tabs.length],
  );

  const handlePagerDragStart = React.useCallback(() => {
    endProgrammaticScrollGuard();
  }, [endProgrammaticScrollGuard]);

  const handleNativePageSelected = React.useCallback(
    (event: NativePagerViewOnPageSelectedEvent) => {
      const settledIndex = clampPageIndex(
        event.nativeEvent.position,
        tabs.length,
      );

      if (programmaticScrollRef.current) {
        currentPageRef.current = settledIndex;
        previewPageRef.current = settledIndex;
        emitPageProgress(settledIndex);
        syncPreviewHeight(settledIndex);
        endProgrammaticScrollGuard();
        return;
      }

      settleTabIndex(settledIndex, true);
    },
    [
      emitPageProgress,
      endProgrammaticScrollGuard,
      settleTabIndex,
      syncPreviewHeight,
      tabs.length,
    ],
  );

  const handleNativePageScroll = React.useCallback(
    (event: NativePagerViewOnPageScrollEvent) => {
      if (programmaticScrollRef.current) {
        return;
      }

      const absolutePageOffset =
        event.nativeEvent.position + event.nativeEvent.offset;
      emitPageProgress(absolutePageOffset);
      const nextIndex = resolvePagedScrollIndex(
        absolutePageOffset,
        currentPageRef.current,
        tabs.length,
      );

      emitPreviewIndex(nextIndex);
      syncPreviewHeight(currentPageRef.current, nextIndex);
    },
    [emitPageProgress, emitPreviewIndex, syncPreviewHeight, tabs.length],
  );

  const handleNativePageScrollStateChanged = React.useCallback(
    (event: NativePagerViewOnPageScrollStateChangedEvent) => {
      if (event.nativeEvent.pageScrollState === "dragging") {
        endProgrammaticScrollGuard();
      }
    },
    [endProgrammaticScrollGuard],
  );

  const handleContentPageLayout = React.useCallback(
    (index: number, height: number) => {
      pageHeightsRef.current[index] = height;

      if (index === activeIndex) {
        updateContentPagerHeight(height);
        return;
      }

      if (index === previewPageRef.current) {
        syncPreviewHeight(activeIndex, index);
      }
    },
    [activeIndex, syncPreviewHeight, updateContentPagerHeight],
  );

  if (NativePagerView) {
    return (
      <NativePagerView
        ref={nativePagerRef}
        initialPage={activeIndex}
        offscreenPageLimit={keepAlive ? Math.max(1, tabs.length - 1) : 1}
        onPageScroll={handleNativePageScroll}
        onPageScrollStateChanged={handleNativePageScrollStateChanged}
        onPageSelected={handleNativePageSelected}
        scrollEnabled={scrollEnabled && tabs.length > 1}
        style={[
          styles.contentPager,
          contentPagerHeight ? { height: contentPagerHeight } : null,
          style,
        ]}
      >
        {tabs.map((tab, index) => {
          const active = index === activeIndex;
          const shouldRender = shouldRenderPagedItem(
            index,
            renderWindowIndex,
            keepAlive,
            lazy,
          );

          return (
            <View collapsable={false} key={tab.key} style={styles.nativePage}>
              <View
                collapsable={false}
                onLayout={(event) =>
                  handleContentPageLayout(index, event.nativeEvent.layout.height)
                }
              >
                {shouldRender ? renderPage(tab.key, index, active) : null}
              </View>
            </View>
          );
        })}
      </NativePagerView>
    );
  }

  return (
    <FlatList
      ref={flatPagerRef}
      data={tabs}
      decelerationRate="fast"
      directionalLockEnabled
      disableIntervalMomentum
      extraData={`${activeIndex}:${pageWidth}:${contentPagerHeight ?? 0}`}
      getItemLayout={(_, index) => ({
        index,
        length: pageWidth,
        offset: pageWidth * index,
      })}
      horizontal
      initialScrollIndex={activeIndex}
      keyExtractor={(item) => item.key}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onMomentumScrollEnd={handleFlatScrollPageSettled}
      onScroll={handleFlatScroll}
      onScrollBeginDrag={handlePagerDragStart}
      onScrollToIndexFailed={({ index }) => {
        flatPagerRef.current?.scrollToOffset({
          animated: false,
          offset: pageWidth * index,
        });
      }}
      overScrollMode="never"
      pagingEnabled
      removeClippedSubviews={false}
      renderItem={({ item: tab, index }) => {
        const active = index === activeIndex;
        const shouldRender = shouldRenderPagedItem(
          index,
          renderWindowIndex,
          keepAlive,
          lazy,
        );

        return (
          <View collapsable={false} style={[styles.contentPage, { width: pageWidth }]}>
            <View
              collapsable={false}
              onLayout={(event) =>
                handleContentPageLayout(index, event.nativeEvent.layout.height)
              }
            >
              {shouldRender ? renderPage(tab.key, index, active) : null}
            </View>
          </View>
        );
      }}
      scrollEnabled={scrollEnabled && tabs.length > 1}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      style={[
        styles.contentPager,
        contentPagerHeight ? { height: contentPagerHeight } : null,
        style,
      ]}
      windowSize={keepAlive ? Math.max(3, tabs.length) : 3}
    />
  );
}

function SwipeableFillPager<TTab extends string>({
  activeIndex,
  activeTab,
  keepAlive = true,
  lazy = false,
  onPageProgressChange,
  onTabChange,
  onTabPreviewChange,
  pageWidth,
  renderPage,
  scrollEnabled = true,
  style,
  tabs,
}: SharedPagerProps<TTab>) {
  const pagerRef = React.useRef<FlatList<
    SwipeableCategoryPagerTab<TTab>
  > | null>(null);
  const currentPageRef = React.useRef(activeIndex);
  const previewPageRef = React.useRef(activeIndex);
  const didMountRef = React.useRef(false);
  const lastPageWidthRef = React.useRef(pageWidth);
  const programmaticScrollRef = React.useRef(false);
  const programmaticScrollTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [renderWindowIndex, setRenderWindowIndex] = React.useState(activeIndex);

  const clearProgrammaticScrollTimer = React.useCallback(() => {
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
      programmaticScrollTimerRef.current = null;
    }
  }, []);

  const beginProgrammaticScrollGuard = React.useCallback(() => {
    clearProgrammaticScrollTimer();
    programmaticScrollRef.current = true;
    programmaticScrollTimerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
      programmaticScrollTimerRef.current = null;
    }, PROGRAMMATIC_SCROLL_GUARD_MS);
  }, [clearProgrammaticScrollTimer]);

  const endProgrammaticScrollGuard = React.useCallback(() => {
    clearProgrammaticScrollTimer();
    programmaticScrollRef.current = false;
  }, [clearProgrammaticScrollTimer]);

  React.useEffect(
    () => () => {
      clearProgrammaticScrollTimer();
    },
    [clearProgrammaticScrollTimer],
  );

  const announceTabChange = React.useCallback(
    (tabLabel: string, index: number) => {
      AccessibilityInfo.announceForAccessibility(
        `${tabLabel} sekmesi, ${index + 1}/${tabs.length}`,
      );
    },
    [tabs.length],
  );

  const emitPreviewIndex = React.useCallback(
    (nextIndex: number) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);

      if (previewPageRef.current === clampedIndex) {
        return;
      }

      const nextTab = tabs[clampedIndex];

      if (!nextTab) {
        return;
      }

      previewPageRef.current = clampedIndex;
      setRenderWindowIndex(clampedIndex);
      onTabPreviewChange?.(nextTab.key);
    },
    [onTabPreviewChange, tabs],
  );

  const emitPageProgress = React.useCallback(
    (pageOffset: number) => {
      onPageProgressChange?.(clampPageProgress(pageOffset, tabs.length));
    },
    [onPageProgressChange, tabs.length],
  );

  const settleTabIndex = React.useCallback(
    (nextIndex: number, announce = false) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);
      const nextTab = tabs[clampedIndex];

      if (!nextTab) {
        return;
      }

      currentPageRef.current = clampedIndex;
      emitPreviewIndex(clampedIndex);
      emitPageProgress(clampedIndex);

      if (nextTab.key !== activeTab) {
        onTabChange(nextTab.key);
        if (announce) {
          announceTabChange(nextTab.label, clampedIndex);
        }
      }
    },
    [
      activeTab,
      announceTabChange,
      emitPageProgress,
      emitPreviewIndex,
      onTabChange,
      tabs,
    ],
  );

  React.useEffect(() => {
    const widthChanged = lastPageWidthRef.current !== pageWidth;

    if (currentPageRef.current === activeIndex && !widthChanged) {
      emitPageProgress(activeIndex);
      return;
    }

    currentPageRef.current = activeIndex;
    previewPageRef.current = activeIndex;
    setRenderWindowIndex(activeIndex);
    emitPageProgress(activeIndex);
    onTabPreviewChange?.(tabs[activeIndex]?.key ?? activeTab);
    lastPageWidthRef.current = pageWidth;
    beginProgrammaticScrollGuard();
    const handle = requestAnimationFrame(() => {
      pagerRef.current?.scrollToIndex({
        animated: didMountRef.current && !widthChanged,
        index: activeIndex,
      });
      didMountRef.current = true;
    });
    return () => cancelAnimationFrame(handle);
  }, [
    activeIndex,
    activeTab,
    beginProgrammaticScrollGuard,
    emitPageProgress,
    onTabPreviewChange,
    pageWidth,
    tabs,
  ]);

  const handleScrollPageSettled = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settledIndex = clampPageIndex(
        Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        tabs.length,
      );

      if (programmaticScrollRef.current) {
        currentPageRef.current = settledIndex;
        previewPageRef.current = settledIndex;
        emitPageProgress(settledIndex);
        endProgrammaticScrollGuard();
        return;
      }

      settleTabIndex(settledIndex, true);
    },
    [
      emitPageProgress,
      endProgrammaticScrollGuard,
      pageWidth,
      settleTabIndex,
      tabs.length,
    ],
  );

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (programmaticScrollRef.current) {
        return;
      }

      const absolutePageOffset = event.nativeEvent.contentOffset.x / pageWidth;
      emitPageProgress(absolutePageOffset);
      const nextIndex = resolvePagedScrollIndex(
        absolutePageOffset,
        currentPageRef.current,
        tabs.length,
      );

      emitPreviewIndex(nextIndex);
    },
    [emitPageProgress, emitPreviewIndex, pageWidth, tabs.length],
  );

  const handleScrollBeginDrag = React.useCallback(() => {
    endProgrammaticScrollGuard();
  }, [endProgrammaticScrollGuard]);

  return (
    <FlatList
      ref={pagerRef}
      data={tabs}
      decelerationRate="fast"
      directionalLockEnabled
      disableIntervalMomentum
      extraData={`${activeIndex}:${pageWidth}`}
      getItemLayout={(_, index) => ({
        index,
        length: pageWidth,
        offset: pageWidth * index,
      })}
      horizontal
      initialScrollIndex={activeIndex}
      keyExtractor={(item) => item.key}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onMomentumScrollEnd={handleScrollPageSettled}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollToIndexFailed={({ index }) => {
        pagerRef.current?.scrollToOffset({
          animated: false,
          offset: pageWidth * index,
        });
      }}
      overScrollMode="never"
      pagingEnabled
      removeClippedSubviews={false}
      renderItem={({ item: tab, index }) => {
        const active = index === activeIndex;
        const shouldRender = shouldRenderPagedItem(
          index,
          renderWindowIndex,
          keepAlive,
          lazy,
        );

        return (
          <View collapsable={false} style={[styles.page, { width: pageWidth }]}>
            {shouldRender ? renderPage(tab.key, index, active) : null}
          </View>
        );
      }}
      scrollEnabled={scrollEnabled && tabs.length > 1}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      style={[styles.pager, style]}
      windowSize={keepAlive ? Math.max(3, tabs.length) : 3}
    />
  );
}

export function SwipeableCategoryPager<TTab extends string>({
  activeTab,
  keepAlive = true,
  layoutMode = "fill",
  lazy = false,
  tabs,
  onPageProgressChange,
  onTabChange,
  onTabPreviewChange,
  renderPage,
  scrollEnabled = true,
  style,
}: SwipeableCategoryPagerProps<TTab>) {
  const { width: windowWidth } = useWindowDimensions();
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeTab),
  );
  const pageWidth = Math.max(1, windowWidth);
  const sharedProps = {
    activeIndex,
    activeTab,
    keepAlive,
    lazy,
    onPageProgressChange,
    onTabChange,
    onTabPreviewChange,
    pageWidth,
    renderPage,
    scrollEnabled,
    style,
    tabs,
  } satisfies SharedPagerProps<TTab>;

  if (layoutMode === "content") {
    return <SwipeableContentPager {...sharedProps} />;
  }

  return <SwipeableFillPager {...sharedProps} />;
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    height: "100%",
  },
  contentPager: {
    width: "100%",
  },
  contentPage: {
    width: "100%",
  },
  nativePage: {
    flex: 1,
  },
});
