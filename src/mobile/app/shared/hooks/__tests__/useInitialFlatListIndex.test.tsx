import type { FlatList } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInitialFlatListIndex } from '@/mobile/app/shared/hooks/useInitialFlatListIndex';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

type TestItem = { id: string };

describe('useInitialFlatListIndex', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('preserves the clamped deep-link index without publishing an inexact item layout', () => {
    const hook = renderHook(() =>
      useInitialFlatListIndex<TestItem>({
        estimatedItemLength: 600,
        itemCount: 12,
        startIndex: 99,
      }),
    );
    const listHandle = {
      scrollToIndex: vi.fn(),
      scrollToOffset: vi.fn(),
    };
    hook.result.current.listRef.current = listHandle as unknown as FlatList<TestItem>;

    expect(hook.result.current.safeStartIndex).toBe(11);
    expect(hook.result.current.initialScrollIndex).toBe(11);
    expect(hook.result.current).not.toHaveProperty('getItemLayout');

    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(listHandle.scrollToIndex).toHaveBeenCalledWith({
      animated: false,
      index: 11,
      viewPosition: 0,
    });

    hook.unmount();
  });

  it('uses measured averages only as a coarse fallback before retrying the real index', () => {
    const hook = renderHook(() =>
      useInitialFlatListIndex<TestItem>({
        estimatedItemLength: 600,
        itemCount: 50,
        startIndex: 20,
      }),
    );
    const listHandle = {
      scrollToIndex: vi.fn(),
      scrollToOffset: vi.fn(),
    };
    hook.result.current.listRef.current = listHandle as unknown as FlatList<TestItem>;

    act(() => {
      hook.result.current.handleScrollToIndexFailed({
        averageItemLength: 480,
        highestMeasuredFrameIndex: 4,
        index: 20,
      });
    });

    expect(listHandle.scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 9_600,
    });
    expect(listHandle.scrollToIndex).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(listHandle.scrollToIndex).toHaveBeenCalledWith({
      animated: false,
      index: 20,
      viewPosition: 0,
    });

    hook.unmount();
  });

  it('falls back to the configured estimate when the list has no measurements yet', () => {
    const hook = renderHook(() =>
      useInitialFlatListIndex<TestItem>({
        estimatedItemLength: 550,
        itemCount: 30,
        startIndex: 10,
      }),
    );
    const listHandle = {
      scrollToIndex: vi.fn(),
      scrollToOffset: vi.fn(),
    };
    hook.result.current.listRef.current = listHandle as unknown as FlatList<TestItem>;

    act(() => {
      hook.result.current.handleScrollToIndexFailed({
        averageItemLength: 0,
        highestMeasuredFrameIndex: 0,
        index: 10,
      });
    });

    expect(listHandle.scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 5_500,
    });

    hook.unmount();
  });

  it('caps retries when native measurement repeatedly rejects the target index', () => {
    const hook = renderHook(() =>
      useInitialFlatListIndex<TestItem>({
        estimatedItemLength: 500,
        itemCount: 100,
        startIndex: 75,
      }),
    );
    const listHandle = {
      scrollToIndex: vi.fn(),
      scrollToOffset: vi.fn(),
    };
    hook.result.current.listRef.current = listHandle as unknown as FlatList<TestItem>;
    const failure = {
      averageItemLength: 500,
      highestMeasuredFrameIndex: 5,
      index: 75,
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      act(() => {
        hook.result.current.handleScrollToIndexFailed(failure);
        vi.advanceTimersByTime(80);
      });
    }

    expect(listHandle.scrollToIndex).toHaveBeenCalledTimes(3);
    expect(listHandle.scrollToOffset).toHaveBeenCalledTimes(4);

    hook.unmount();
  });
});
