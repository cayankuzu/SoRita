import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@/mobile/app/shared/hooks/useModalAnimationType', () => ({
  useModalAnimationType: () => 'none',
}));

import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';

describe('ModalScaffold accessibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces the modal without grouping its interactive descendants', () => {
    const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ModalScaffold
          accessibilityLabel="İşlem menüsü"
          onClose={vi.fn()}
          visible
        >
          <Text accessibilityRole="button">Seçenek</Text>
        </ModalScaffold>,
      );
    });

    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(announce).toHaveBeenCalledWith('İşlem menüsü');
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'KeyboardAvoidingView' &&
          node.props.accessibilityViewIsModal === true,
      ),
    ).toHaveLength(1);
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
