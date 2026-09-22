import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setAccessibilityFocusMock = vi.fn();
const announceForAccessibilityMock = vi.fn();
const findNodeHandleMock = vi.fn((_target: unknown) => 11);

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    setAccessibilityFocus: (...args: unknown[]) => setAccessibilityFocusMock(...args),
    announceForAccessibility: (...args: unknown[]) => announceForAccessibilityMock(...args),
  },
  findNodeHandle: (target: unknown) => findNodeHandleMock(target),
}));

const { act, renderHook } = await import('@/mobile/app/test/hookTestUtils');
const { useLightboxAnnouncements } = await import(
  '@/mobile/app/shared/components/feedback/useLightboxAnnouncements'
);

type Options = Parameters<typeof useLightboxAnnouncements>[0];

function setup(overrides: Partial<Options> = {}) {
  const state = {
    currentIndex: 0,
    flatListKey: 'k1',
    itemCount: 3,
    positionLabel: 'Fotoğraf 1/3',
    setCurrentIndex: vi.fn(),
    startIndex: 0,
    suppressFocus: false,
    titleRef: { current: {} } as React.RefObject<unknown>,
    ...overrides,
  };

  const view = renderHook(() => useLightboxAnnouncements(state));
  return { state, ...view };
}

describe('useLightboxAnnouncements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setAccessibilityFocusMock.mockClear();
    announceForAccessibilityMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the lightbox on the page it was opened at', () => {
    const { state } = setup({ startIndex: 2 });

    expect(state.setCurrentIndex).toHaveBeenCalledWith(2);
  });

  it('puts the reader on the title once the modal has settled', () => {
    setup();
    expect(setAccessibilityFocusMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(setAccessibilityFocusMock).toHaveBeenCalledWith(11);
  });

  it('leaves focus alone while something is layered over the pages', () => {
    setup({ suppressFocus: true });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(setAccessibilityFocusMock).not.toHaveBeenCalled();
  });

  it('does not touch focus when there is nothing to show', () => {
    setup({ itemCount: 0 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(setAccessibilityFocusMock).not.toHaveBeenCalled();
  });

  it('stays silent on the way in, even when opened mid-album', () => {
    // Opening on page 3 must not be read out as though the user swiped there.
    setup({ startIndex: 2, currentIndex: 2, positionLabel: 'Fotoğraf 3/3' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(announceForAccessibilityMock).not.toHaveBeenCalled();
  });

  it('announces the new position after a swipe', () => {
    let currentIndex = 0;
    let positionLabel = 'Fotoğraf 1/3';
    const setCurrentIndex = vi.fn();
    const titleRef = { current: {} } as React.RefObject<unknown>;

    const { rerender } = renderHook(() =>
      useLightboxAnnouncements({
        currentIndex,
        flatListKey: 'k1',
        itemCount: 3,
        positionLabel,
        setCurrentIndex,
        startIndex: 0,
        suppressFocus: false,
        titleRef,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(10);
    });

    currentIndex = 1;
    positionLabel = 'Fotoğraf 2/3';
    rerender();

    expect(announceForAccessibilityMock).toHaveBeenCalledWith('Fotoğraf 2/3');
  });
});
