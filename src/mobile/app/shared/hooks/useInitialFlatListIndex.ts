import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FlatList, FlatListProps } from 'react-native';

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
  const safeStartIndex = useMemo(
    () => Math.max(0, Math.min(startIndex, Math.max(0, itemCount - 1))),
    [itemCount, startIndex],
  );
  const initialScrollIndex = safeStartIndex > 0 ? safeStartIndex : undefined;
  const getItemLayout = useMemo(() => {
    if (!estimatedItemLength || estimatedItemLength <= 0) {
      return undefined;
    }

    const layoutResolver: NonNullable<FlatListProps<ItemT>['getItemLayout']> = (
      _,
      index,
    ) => ({
      index,
      length: estimatedItemLength,
      offset: estimatedItemLength * index,
    });

    return layoutResolver;
  }, [estimatedItemLength]);

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

    const timeoutId = setTimeout(() => {
      if (!hasAttemptedInitialScrollRef.current) {
        scrollToTargetIndex();
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [itemCount, safeStartIndex, scrollToTargetIndex]);

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
      const targetIndex = Math.max(
        0,
        Math.min(info.index, Math.max(0, itemCount - 1)),
      );

      listRef.current?.scrollToOffset({
        offset: Math.max(0, info.averageItemLength * targetIndex),
        animated: false,
      });

      setTimeout(() => {
        scrollToTargetIndex(targetIndex);
      }, 80);
    },
    [itemCount, scrollToTargetIndex],
  );

  return {
    listRef,
    safeStartIndex,
    initialScrollIndex,
    getItemLayout,
    handleContentSizeChange,
    handleScrollToIndexFailed,
  };
}
