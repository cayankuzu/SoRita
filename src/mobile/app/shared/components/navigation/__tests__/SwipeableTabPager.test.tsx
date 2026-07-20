import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';
import {
  clampPageIndex,
  clampPageProgress,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
  SwipeableTabPager,
} from '@/mobile/app/shared/components/navigation/SwipeableTabPager';
import {
  PROGRAMMATIC_SCROLL_GUARD_MS,
  usePagerController,
  useProgrammaticScrollGuard,
} from '@/mobile/app/shared/components/navigation/swipeableTabPagerController';

const TABS = ['lists', 'places', 'photos', 'people'] as const;

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SwipeableTabPager controller', () => {
  it('clamps indexes and animated progress to valid pager bounds', () => {
    expect(clampPageIndex(-2, TABS.length)).toBe(0);
    expect(clampPageIndex(99, TABS.length)).toBe(3);
    expect(clampPageIndex(Number.NaN, TABS.length)).toBe(0);
    expect(clampPageProgress(-1.5, TABS.length)).toBe(0);
    expect(clampPageProgress(1.35, TABS.length)).toBe(1.35);
    expect(clampPageProgress(8, TABS.length)).toBe(3);
  });

  it('changes preview only after the early visual threshold', () => {
    expect(resolvePagedScrollIndex(0.07, 0, TABS.length)).toBe(0);
    expect(resolvePagedScrollIndex(0.08, 0, TABS.length)).toBe(1);
    expect(resolvePagedScrollIndex(0.93, 1, TABS.length)).toBe(1);
    expect(resolvePagedScrollIndex(0.91, 1, TABS.length)).toBe(0);
  });

  it('keeps alive pages or limits a lazy render window', () => {
    expect(shouldRenderPagedItem(3, 0, true, true)).toBe(true);
    expect(shouldRenderPagedItem(3, 0, false, false)).toBe(true);
    expect(shouldRenderPagedItem(3, 0, false, true)).toBe(false);
    expect(shouldRenderPagedItem(2, 0, false, true)).toBe(true);
  });

  it('commits one onChange call for one settled swipe', () => {
    const onChange = vi.fn();
    const hook = renderHook(() =>
      usePagerController({
        activeIndex: 0,
        activeTab: 'lists' as (typeof TABS)[number],
        onChange,
        tabs: TABS,
      }),
    );

    act(() => {
      hook.result.current.settleTabIndex(1);
      hook.result.current.settleTabIndex(1);
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('places');
  });

  it('clears the programmatic scroll guard after its safety window', () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useProgrammaticScrollGuard());

    act(() => hook.result.current.begin());
    expect(hook.result.current.programmaticScrollRef.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(PROGRAMMATIC_SCROLL_GUARD_MS);
    });
    expect(hook.result.current.programmaticScrollRef.current).toBe(false);
  });
});

describe('SwipeableTabPager component', () => {
  it('disables horizontal paging when only one tab exists', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <SwipeableTabPager
          activeTab="lists"
          onChange={vi.fn()}
          renderPage={() => null}
          tabs={['lists'] as const}
        />,
      );
    });

    const list = renderer.root.find((node) => String(node.type) === 'FlatList');
    expect(list.props.scrollEnabled).toBe(false);
  });

  it('measures its own container instead of using the window width', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <SwipeableTabPager
          activeTab="lists"
          onChange={vi.fn()}
          renderPage={() => null}
          tabs={['lists', 'places'] as const}
        />,
      );
    });

    const root = renderer.root.find((node) => String(node.type) === 'View');
    act(() => root.props.onLayout({ nativeEvent: { layout: { width: 284 } } }));
    const list = renderer.root.find((node) => String(node.type) === 'FlatList');
    expect(list.props.getItemLayout(null, 1)).toEqual({
      index: 1,
      length: 284,
      offset: 284,
    });
  });
});
