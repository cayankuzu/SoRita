import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  loadNativePagerView,
  type NativePagerViewHandle,
  type NativePagerViewOnPageScrollEvent,
  type NativePagerViewOnPageScrollStateChangedEvent,
  type NativePagerViewOnPageSelectedEvent,
} from '@/mobile/app/shared/components/navigation/pagerViewAdapter';
import {
  clampPageIndex,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
  usePagerController,
  useProgrammaticScrollGuard,
} from '@/mobile/app/shared/components/navigation/swipeableTabPagerController';
import { colors } from '@/mobile/app/shared/theme/tokens';

export {
  clampPageIndex,
  clampPageProgress,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
} from '@/mobile/app/shared/components/navigation/swipeableTabPagerController';

export type SwipeableTabPagerProps<TTab extends string> = {
  activeTab: TTab;
  enabled?: boolean;
  getTabLabel?: (tab: TTab) => string;
  keepAlive?: boolean;
  layoutMode?: 'content' | 'fill';
  lazy?: boolean;
  onChange: (tab: TTab) => void;
  onPageProgressChange?: (pageOffset: number) => void;
  onPreviewTabChange?: (tab: TTab) => void;
  renderPage: (tab: TTab, preview: boolean, active: boolean) => ReactNode;
  style?: StyleProp<ViewStyle>;
  tabs: readonly TTab[];
  testID?: string;
};

type SharedPagerProps<TTab extends string> = Omit<
  SwipeableTabPagerProps<TTab>,
  'layoutMode' | 'style' | 'testID'
> & {
  activeIndex: number;
  pageWidth: number;
};

function SwipeableFillPager<TTab extends string>({
  activeIndex,
  activeTab,
  enabled = true,
  getTabLabel,
  keepAlive = true,
  lazy = false,
  onChange,
  onPageProgressChange,
  onPreviewTabChange,
  pageWidth,
  renderPage,
  tabs,
}: SharedPagerProps<TTab>) {
  const pagerRef = useRef<FlatList<TTab> | null>(null);
  const didMountRef = useRef(false);
  const lastPageWidthRef = useRef(pageWidth);
  const { begin, end, programmaticScrollRef } = useProgrammaticScrollGuard();
  const {
    currentPageRef,
    emitPageProgress,
    emitPreviewIndex,
    renderWindowIndex,
    settleTabIndex,
    syncActiveIndex,
  } = usePagerController({
    activeIndex,
    activeTab,
    getTabLabel,
    onChange,
    onPageProgressChange,
    onPreviewTabChange,
    tabs,
  });

  useEffect(() => {
    const widthChanged = lastPageWidthRef.current !== pageWidth;

    if (currentPageRef.current === activeIndex && !widthChanged) {
      emitPageProgress(activeIndex);
      return;
    }

    lastPageWidthRef.current = pageWidth;
    syncActiveIndex();
    begin();
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollToIndex({
        animated: didMountRef.current && !widthChanged,
        index: activeIndex,
      });
      didMountRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [activeIndex, begin, currentPageRef, emitPageProgress, pageWidth, syncActiveIndex]);

  const handleScrollPageSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settledIndex = clampPageIndex(
        Math.round(event.nativeEvent.contentOffset.x / pageWidth),
        tabs.length,
      );

      if (programmaticScrollRef.current) {
        currentPageRef.current = settledIndex;
        emitPageProgress(settledIndex);
        end();
        return;
      }

      settleTabIndex(settledIndex, true);
    },
    [
      currentPageRef,
      emitPageProgress,
      end,
      pageWidth,
      programmaticScrollRef,
      settleTabIndex,
      tabs.length,
    ],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (programmaticScrollRef.current) {
        return;
      }

      const pageOffset = event.nativeEvent.contentOffset.x / pageWidth;
      emitPageProgress(pageOffset);
      emitPreviewIndex(
        resolvePagedScrollIndex(pageOffset, currentPageRef.current, tabs.length),
      );
    },
    [
      currentPageRef,
      emitPageProgress,
      emitPreviewIndex,
      pageWidth,
      programmaticScrollRef,
      tabs.length,
    ],
  );

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
      keyExtractor={(tab) => tab}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onMomentumScrollEnd={handleScrollPageSettled}
      onScroll={handleScroll}
      onScrollBeginDrag={end}
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
            {shouldRender ? renderPage(tab, !active, active) : null}
          </View>
        );
      }}
      scrollEnabled={enabled && tabs.length > 1}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      style={styles.pager}
      windowSize={keepAlive ? Math.max(3, tabs.length) : 3}
    />
  );
}

function SwipeableContentPager<TTab extends string>(
  props: SharedPagerProps<TTab>,
) {
  const NativePagerView = useMemo(() => loadNativePagerView(), []);
  const nativePagerRef = useRef<NativePagerViewHandle | null>(null);
  const flatPagerRef = useRef<FlatList<TTab> | null>(null);
  const didMountRef = useRef(false);
  const lastPageWidthRef = useRef(props.pageWidth);
  const [height, setHeight] = useState<number | null>(null);
  const maxHeightRef = useRef(0);
  const { begin, end, programmaticScrollRef } = useProgrammaticScrollGuard();
  const controller = usePagerController(props);
  const {
    activeIndex,
    enabled = true,
    keepAlive = true,
    lazy = false,
    pageWidth,
    renderPage,
    tabs,
  } = props;
  const {
    currentPageRef,
    emitPageProgress,
    emitPreviewIndex,
    renderWindowIndex,
    settleTabIndex,
    syncActiveIndex,
  } = controller;

  const updateHeight = useCallback((nextHeight: number) => {
    if (nextHeight <= 0) {
      return;
    }

    maxHeightRef.current = Math.max(maxHeightRef.current, nextHeight);
    setHeight((currentHeight) =>
      currentHeight && Math.abs(currentHeight - maxHeightRef.current) < 1
        ? currentHeight
        : maxHeightRef.current,
    );
  }, []);

  useEffect(() => {
    const widthChanged = lastPageWidthRef.current !== pageWidth;
    lastPageWidthRef.current = pageWidth;
    syncActiveIndex();
    begin();
    const frame = requestAnimationFrame(() => {
      if (NativePagerView) {
        if (didMountRef.current && !widthChanged) {
          nativePagerRef.current?.setPage(activeIndex);
        } else {
          nativePagerRef.current?.setPageWithoutAnimation(activeIndex);
        }
      } else {
        flatPagerRef.current?.scrollToIndex({
          animated: didMountRef.current && !widthChanged,
          index: activeIndex,
        });
      }
      didMountRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [NativePagerView, activeIndex, begin, pageWidth, syncActiveIndex]);

  const settleProgrammaticPage = useCallback(
    (settledIndex: number) => {
      currentPageRef.current = settledIndex;
      emitPageProgress(settledIndex);
      end();
    },
    [currentPageRef, emitPageProgress, end],
  );

  const handleNativePageSelected = useCallback(
    (event: NativePagerViewOnPageSelectedEvent) => {
      const settledIndex = clampPageIndex(event.nativeEvent.position, tabs.length);

      if (programmaticScrollRef.current) {
        settleProgrammaticPage(settledIndex);
        return;
      }

      settleTabIndex(settledIndex, true);
    },
    [programmaticScrollRef, settleProgrammaticPage, settleTabIndex, tabs.length],
  );

  const handleNativePageScroll = useCallback(
    (event: NativePagerViewOnPageScrollEvent) => {
      if (programmaticScrollRef.current) {
        return;
      }

      const pageOffset = event.nativeEvent.position + event.nativeEvent.offset;
      emitPageProgress(pageOffset);
      emitPreviewIndex(
        resolvePagedScrollIndex(pageOffset, currentPageRef.current, tabs.length),
      );
    },
    [
      currentPageRef,
      emitPageProgress,
      emitPreviewIndex,
      programmaticScrollRef,
      tabs.length,
    ],
  );

  const handleNativeScrollStateChange = useCallback(
    (event: NativePagerViewOnPageScrollStateChangedEvent) => {
      if (event.nativeEvent.pageScrollState === 'dragging') {
        end();
      }
    },
    [end],
  );

  if (!NativePagerView) {
    return (
      <FlatList
        ref={flatPagerRef}
        data={tabs}
        decelerationRate="fast"
        directionalLockEnabled
        disableIntervalMomentum
        extraData={`${activeIndex}:${pageWidth}:${height ?? 0}`}
        getItemLayout={(_, index) => ({
          index,
          length: pageWidth,
          offset: pageWidth * index,
        })}
        horizontal
        initialScrollIndex={activeIndex}
        keyExtractor={(tab) => tab}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onMomentumScrollEnd={(event) => {
          const settledIndex = clampPageIndex(
            Math.round(event.nativeEvent.contentOffset.x / pageWidth),
            tabs.length,
          );

          if (programmaticScrollRef.current) {
            settleProgrammaticPage(settledIndex);
            return;
          }

          settleTabIndex(settledIndex, true);
        }}
        onScroll={(event) => {
          if (programmaticScrollRef.current) {
            return;
          }

          const pageOffset = event.nativeEvent.contentOffset.x / pageWidth;
          emitPageProgress(pageOffset);
          emitPreviewIndex(
            resolvePagedScrollIndex(
              pageOffset,
              currentPageRef.current,
              tabs.length,
            ),
          );
        }}
        onScrollBeginDrag={end}
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
            <View
              collapsable={false}
              style={[styles.contentPage, { width: pageWidth }]}
            >
              <View
                collapsable={false}
                onLayout={(event) => updateHeight(event.nativeEvent.layout.height)}
              >
                {shouldRender ? renderPage(tab, !active, active) : null}
              </View>
            </View>
          );
        }}
        scrollEnabled={enabled && tabs.length > 1}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={[styles.contentPager, height ? { height } : null]}
        windowSize={keepAlive ? Math.max(3, tabs.length) : 3}
      />
    );
  }

  return (
    <NativePagerView
      ref={nativePagerRef}
      initialPage={activeIndex}
      offscreenPageLimit={keepAlive ? Math.max(1, tabs.length - 1) : 1}
      onPageScroll={handleNativePageScroll}
      onPageScrollStateChanged={handleNativeScrollStateChange}
      onPageSelected={handleNativePageSelected}
      scrollEnabled={enabled && tabs.length > 1}
      style={[styles.contentPager, height ? { height } : null]}
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
          <View collapsable={false} key={tab} style={styles.nativePage}>
            <View
              collapsable={false}
              onLayout={(event) => updateHeight(event.nativeEvent.layout.height)}
            >
              {shouldRender ? renderPage(tab, !active, active) : null}
            </View>
          </View>
        );
      })}
    </NativePagerView>
  );
}

export function SwipeableTabPager<TTab extends string>({
  activeTab,
  layoutMode = 'fill',
  style,
  tabs,
  testID,
  ...props
}: SwipeableTabPagerProps<TTab>) {
  const [pageWidth, setPageWidth] = useState(1);
  const activeIndex = clampPageIndex(
    tabs.findIndex((tab) => tab === activeTab),
    tabs.length,
  );
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.max(1, Math.round(event.nativeEvent.layout.width));
    setPageWidth((currentWidth) =>
      Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth,
    );
  }, []);
  const sharedProps = {
    ...props,
    activeIndex,
    activeTab,
    pageWidth,
    tabs,
  } satisfies SharedPagerProps<TTab>;

  return (
    <View
      onLayout={handleLayout}
      style={[
        layoutMode === 'fill' ? styles.fillRoot : styles.contentRoot,
        style,
      ]}
      testID={testID}
    >
      {tabs.length === 0 ? null : layoutMode === 'content' ? (
        <SwipeableContentPager {...sharedProps} />
      ) : (
        <SwipeableFillPager {...sharedProps} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contentPage: {
    backgroundColor: colors.background,
    width: '100%',
  },
  contentPager: {
    backgroundColor: colors.background,
    width: '100%',
  },
  contentRoot: {
    backgroundColor: colors.background,
    width: '100%',
  },
  fillRoot: {
    backgroundColor: colors.background,
    flex: 1,
    width: '100%',
  },
  nativePage: {
    backgroundColor: colors.background,
    flex: 1,
  },
  page: {
    backgroundColor: colors.background,
    flex: 1,
    height: '100%',
  },
  pager: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
