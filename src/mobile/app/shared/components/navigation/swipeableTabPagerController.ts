import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const PAGE_SELECTION_SYNC_THRESHOLD = 0.08;
export const PROGRAMMATIC_SCROLL_GUARD_MS = 700;
export const LAZY_RENDER_RADIUS = 1;

export function clampPageIndex(index: number, total: number) {
  if (!Number.isFinite(index) || total <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.round(index), 0), total - 1);
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
  const safeCurrentIndex = clampPageIndex(currentIndex, total);
  const safePageOffset = clampPageProgress(pageOffset, total);
  const delta = safePageOffset - safeCurrentIndex;

  if (delta >= threshold) {
    return clampPageIndex(Math.ceil(safePageOffset), total);
  }

  if (delta <= -threshold) {
    return clampPageIndex(Math.floor(safePageOffset), total);
  }

  return safeCurrentIndex;
}

/**
 * Which pages hold content. Without `lazy` every page renders. With it, a page
 * renders once it comes within a page of the one in view; `keepAlive` then
 * keeps it rendered after the user moves on, so coming back never shows a
 * blank page while its list rebuilds, and unvisited tabs still cost nothing.
 */
export function shouldRenderPagedItem(
  index: number,
  anchorIndex: number,
  keepAlive: boolean,
  lazy: boolean,
  radius = LAZY_RENDER_RADIUS,
  visited: ReadonlySet<number> = new Set(),
) {
  if (!lazy) {
    return true;
  }

  return Math.abs(index - anchorIndex) <= radius || (keepAlive && visited.has(index));
}

export function useProgrammaticScrollGuard() {
  const programmaticScrollRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (!timerRef.current) {
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const begin = useCallback(() => {
    clear();
    programmaticScrollRef.current = true;
    timerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
      timerRef.current = null;
    }, PROGRAMMATIC_SCROLL_GUARD_MS);
  }, [clear]);

  const end = useCallback(() => {
    clear();
    programmaticScrollRef.current = false;
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { begin, end, programmaticScrollRef };
}

type PagerControllerParams<TTab extends string> = {
  activeIndex: number;
  activeTab: TTab;
  getTabLabel?: (tab: TTab) => string;
  onChange: (tab: TTab) => void;
  onPageProgressChange?: (pageOffset: number) => void;
  onPreviewTabChange?: (tab: TTab) => void;
  tabs: readonly TTab[];
};

export function usePagerController<TTab extends string>({
  activeIndex,
  activeTab,
  getTabLabel,
  onChange,
  onPageProgressChange,
  onPreviewTabChange,
  tabs,
}: PagerControllerParams<TTab>) {
  const currentPageRef = useRef(activeIndex);
  const previewPageRef = useRef(activeIndex);
  const [renderWindowIndex, setRenderWindowIndex] = useState(activeIndex);
  const [visitedIndices, setVisitedIndices] = useState<ReadonlySet<number>>(
    () => new Set([activeIndex]),
  );

  useEffect(() => {
    setVisitedIndices((current) => {
      const next = new Set(current);
      for (let offset = -LAZY_RENDER_RADIUS; offset <= LAZY_RENDER_RADIUS; offset += 1) {
        const index = renderWindowIndex + offset;
        if (index >= 0 && index < tabs.length) next.add(index);
      }
      return next.size === current.size ? current : next;
    });
  }, [renderWindowIndex, tabs.length]);

  const announceTabChange = useCallback(
    (tab: TTab, index: number) => {
      AccessibilityInfo.announceForAccessibility(
        `${getTabLabel?.(tab) ?? String(tab)} sekmesi, ${index + 1}/${tabs.length}`,
      );
    },
    [getTabLabel, tabs.length],
  );

  const emitPreviewIndex = useCallback(
    (nextIndex: number) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);
      const nextTab = tabs[clampedIndex];

      if (!nextTab || previewPageRef.current === clampedIndex) {
        return;
      }

      previewPageRef.current = clampedIndex;
      setRenderWindowIndex(clampedIndex);
      onPreviewTabChange?.(nextTab);
    },
    [onPreviewTabChange, tabs],
  );

  const emitPageProgress = useCallback(
    (pageOffset: number) => {
      onPageProgressChange?.(clampPageProgress(pageOffset, tabs.length));
    },
    [onPageProgressChange, tabs.length],
  );

  const settleTabIndex = useCallback(
    (nextIndex: number, announce = false) => {
      const clampedIndex = clampPageIndex(nextIndex, tabs.length);
      const nextTab = tabs[clampedIndex];

      if (!nextTab) {
        return;
      }

      const alreadySettled = currentPageRef.current === clampedIndex;
      currentPageRef.current = clampedIndex;
      emitPreviewIndex(clampedIndex);
      emitPageProgress(clampedIndex);

      if (!alreadySettled && nextTab !== activeTab) {
        onChange(nextTab);
        if (announce) {
          announceTabChange(nextTab, clampedIndex);
        }
      }
    },
    [activeTab, announceTabChange, emitPageProgress, emitPreviewIndex, onChange, tabs],
  );

  const syncActiveIndex = useCallback(() => {
    currentPageRef.current = activeIndex;
    previewPageRef.current = activeIndex;
    setRenderWindowIndex(activeIndex);
    emitPageProgress(activeIndex);
    onPreviewTabChange?.(tabs[activeIndex] ?? activeTab);
  }, [activeIndex, activeTab, emitPageProgress, onPreviewTabChange, tabs]);

  return {
    currentPageRef,
    emitPageProgress,
    emitPreviewIndex,
    previewPageRef,
    renderWindowIndex,
    settleTabIndex,
    syncActiveIndex,
    visitedIndices,
  };
}
