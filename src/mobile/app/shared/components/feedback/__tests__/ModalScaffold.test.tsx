import React from 'react';
import { AccessibilityInfo } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@/mobile/app/shared/hooks/useModalAnimationType', () => ({
  useModalAnimationType: () => 'none',
}));

import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';import { AppText } from '@/mobile/app/shared/components/ui/AppText';


describe('ModalScaffold accessibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces the modal without grouping its interactive descendants', () => {
    const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const onClose = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ModalScaffold
          accessibilityLabel="İşlem menüsü"
          onClose={onClose}
          visible
        >
          <AppText accessibilityRole="button">Seçenek</AppText>
        </ModalScaffold>,
      );
    });

    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(announce).toHaveBeenCalledWith('İşlem menüsü');
    const modalSurface = renderer.root.find(
      (node) =>
        String(node.type) === 'KeyboardAvoidingView' &&
        node.props.accessibilityViewIsModal === true,
    );
    expect(modalSurface.props.onAccessibilityEscape).toEqual(expect.any(Function));
    act(() => modalSurface.props.onAccessibilityEscape());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      renderer.root.findAll((node) => node.props.accessible === true),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Text' && node.props.accessibilityRole === 'button',
      ),
    ).toHaveLength(1);
  });
});
