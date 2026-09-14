import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FlatList, FlatListProps } from 'react-native';

const INITIAL_SCROLL_RETRY_DELAY_MS = 80;
const MAX_INITIAL_SCROLL_RETRIES = 3;

type UseInitialFlatListIndexParams = {
  estimatedItemLength?: number;
  itemCount: number;
  startIndex: number;
};

export function useInitialFlatListIndex<ItemT>({
  estimatedItemLength,
  itemCount,
  startIndex,
}: UseInitialFlatListIndexParams) {
  const listRef = useRef<FlatList<ItemT>>(null);
  const hasAttemptedInitialScrollRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeStartIndex = useMemo(
    () => Math.max(0, Math.min(startIndex, Math.max(0, itemCount - 1))),
    [itemCount, startIndex],
  );
  const initialScrollIndex = safeStartIndex > 0 ? safeStartIndex : undefined;
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current == null) {
      return;
    }

    clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = null;
  }, []);

  const scrollToTargetIndex = useCallback(
    (index = safeStartIndex) => {
      hasAttemptedInitialScrollRef.current = true;

      if (index <= 0) {
        return;
      }

      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0,
        });
      });
    },
    [safeStartIndex],
  );

  useEffect(() => {
    hasAttemptedInitialScrollRef.current = false;
    retryCountRef.current = 0;
    clearRetryTimeout();

    const timeoutId = setTimeout(() => {
      if (!hasAttemptedInitialScrollRef.current) {
        scrollToTargetIndex();
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      clearRetryTimeout();
    };
  }, [clearRetryTimeout, itemCount, safeStartIndex, scrollToTargetIndex]);

  const handleContentSizeChange = useCallback(() => {
    if (hasAttemptedInitialScrollRef.current) {
      return;
    }

    scrollToTargetIndex();
  }, [scrollToTargetIndex]);

  const handleScrollToIndexFailed = useCallback<
    NonNullable<FlatListProps<ItemT>['onScrollToIndexFailed']>
  >(
    (info) => {
      hasAttemptedInitialScrollRef.current = true;
      const targetIndex = Math.max(
        0,
        Math.min(info.index, Math.max(0, itemCount - 1)),
      );
      const fallbackItemLength = info.averageItemLength > 0
        ? info.averageItemLength
        : Math.max(0, estimatedItemLength ?? 0);

      if (fallbackItemLength > 0) {
        listRef.current?.scrollToOffset({
          offset: fallbackItemLength * targetIndex,
          animated: false,
        });
      }

      clearRetryTimeout();
      if (retryCountRef.current >= MAX_INITIAL_SCROLL_RETRIES) {
        return;
      }

      retryCountRef.current += 1;
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null;
        scrollToTargetIndex(targetIndex);
      }, INITIAL_SCROLL_RETRY_DELAY_MS);
    },
    [clearRetryTimeout, estimatedItemLength, itemCount, scrollToTargetIndex],
  );

  return {
    listRef,
    safeStartIndex,
    initialScrollIndex,
    handleContentSizeChange,
    handleScrollToIndexFailed,
  };
}
