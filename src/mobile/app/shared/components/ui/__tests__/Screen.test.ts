import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-navigation/bottom-tabs', () => ({
  BottomTabBarHeightContext: React.createContext<number | null>(null),
}));

const insets = { bottom: 0, left: 0, right: 0, top: 0 };

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => insets,
}));

import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Screen, getScreenBottomPadding } from '@/mobile/app/shared/components/ui/Screen';
import { spacing } from '@/mobile/app/shared/theme/tokens';

describe('Screen', () => {
  it('reserves the bottom inset exactly once outside the tab navigator', () => {
    insets.bottom = 47;
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(Screen, { children: React.createElement('Content'), scroll: false }),
      );
    });

    const safeArea = renderer.root.findByType('SafeAreaView' as never);
    const fromEdges = (safeArea.props.edges as string[]).includes('bottom') ? insets.bottom : 0;
    const content = renderer.root.find(
      (node) => typeof node.type === 'string'
        && StyleSheet.flatten(node.props.style)?.paddingBottom !== undefined,
    );
    const fromPadding = StyleSheet.flatten(content.props.style).paddingBottom;

    expect(fromEdges + fromPadding).toBe(insets.bottom + spacing.card);
    insets.bottom = 0;
  });
});

describe('getScreenBottomPadding', () => {
  it('does not reserve the bottom tab bar twice inside tab screens', () => {
    expect(getScreenBottomPadding(true, 72, 24)).toBe(0);
  });

  it('uses the safe-area inset outside the tab navigator', () => {
    expect(getScreenBottomPadding(true, null, 24)).toBe(24 + spacing.card);
  });

  it('allows full-bleed screens to opt out', () => {
    expect(getScreenBottomPadding(false, 72, 24)).toBe(0);
  });
});
