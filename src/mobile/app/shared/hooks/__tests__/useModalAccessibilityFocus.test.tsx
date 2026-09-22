import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setAccessibilityFocusMock = vi.fn();
const announceForAccessibilityMock = vi.fn();
const findNodeHandleMock = vi.fn();

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    setAccessibilityFocus: (...args: unknown[]) => setAccessibilityFocusMock(...args),
    announceForAccessibility: (...args: unknown[]) => announceForAccessibilityMock(...args),
  },
  findNodeHandle: (...args: unknown[]) => findNodeHandleMock(...args),
}));

const { act, renderHook } = await import('@/mobile/app/test/hookTestUtils');
const { useModalAccessibilityFocus } = await import(
  '@/mobile/app/shared/hooks/useModalAccessibilityFocus'
);

describe('useModalAccessibilityFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setAccessibilityFocusMock.mockClear();
    announceForAccessibilityMock.mockClear();
    findNodeHandleMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces the modal when it opens with nothing to focus', () => {
    renderHook(() =>
      useModalAccessibilityFocus({ accessibilityLabel: 'Yorum işlemleri', visible: true }),
    );

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(announceForAccessibilityMock).toHaveBeenCalledWith('Yorum işlemleri');
    expect(setAccessibilityFocusMock).not.toHaveBeenCalled();
  });

  it('moves the reader onto the requested element instead of announcing', () => {
    findNodeHandleMock.mockReturnValue(42);
    const initialFocusRef = { current: {} } as React.RefObject<unknown>;

    renderHook(() =>
      useModalAccessibilityFocus({
        accessibilityLabel: 'Yorum işlemleri',
        initialFocusRef,
        visible: true,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(setAccessibilityFocusMock).toHaveBeenCalledWith(42);
    expect(announceForAccessibilityMock).not.toHaveBeenCalled();
  });

  it('stays silent while the modal is closed', () => {
    renderHook(() =>
      useModalAccessibilityFocus({ accessibilityLabel: 'Yorum işlemleri', visible: false }),
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(announceForAccessibilityMock).not.toHaveBeenCalled();
    expect(setAccessibilityFocusMock).not.toHaveBeenCalled();
  });

  it('hands focus back to the opener once it closes', () => {
    findNodeHandleMock.mockReturnValue(7);
    const returnFocusRef = { current: {} } as React.RefObject<unknown>;

    let visible = true;
    const { rerender } = renderHook(() =>
      useModalAccessibilityFocus({
        accessibilityLabel: 'Yorum işlemleri',
        returnFocusRef,
        visible,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(120);
    });
    setAccessibilityFocusMock.mockClear();

    visible = false;
    rerender();
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(setAccessibilityFocusMock).toHaveBeenCalledWith(7);
  });

  it('drops a pending announcement when the modal closes before it fires', () => {
    let visible = true;
    const { rerender } = renderHook(() =>
      useModalAccessibilityFocus({ accessibilityLabel: 'Yorum işlemleri', visible }),
    );

    visible = false;
    rerender();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(announceForAccessibilityMock).not.toHaveBeenCalled();
  });
});
