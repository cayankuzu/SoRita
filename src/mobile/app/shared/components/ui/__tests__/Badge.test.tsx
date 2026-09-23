import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Globe } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { describe, expect, it } from 'vitest';

import { Badge, badgeContentColor } from '@/mobile/app/shared/components/ui/Badge';
import { colors, controlSize } from '@/mobile/app/shared/theme/tokens';

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const root = renderer.root.find((node) => String(node.type) === 'View');
  return { renderer, root, style: StyleSheet.flatten(root.props.style) };
}

describe('Badge', () => {
  it('draws every badge at one height, whatever it holds', () => {
    const { style } = render(<Badge label="150₺ - 450₺" />);
    expect(style.minHeight).toBe(controlSize.badge);
  });

  it('paints the tone behind the label and the matching ink on it', () => {
    const { renderer, style } = render(<Badge label="Açık" tone="success" />);
    expect(style.backgroundColor).toBe(colors.successBg);
    const text = renderer.root.find((node) => String(node.type) === 'Text');
    expect(StyleSheet.flatten(text.props.style).color).toBe(colors.secondary);
    expect(badgeContentColor('overlay')).toBe(colors.onPrimary);
  });

  it('keeps digits equal-width when asked to', () => {
    const { renderer } = render(<Badge label="12" numeric />);
    const text = renderer.root.find((node) => String(node.type) === 'Text');
    expect(StyleSheet.flatten(text.props.style).fontVariant).toEqual(['tabular-nums']);
  });

  it('names an icon-only badge for screen readers and keeps it round', () => {
    const { root, style } = render(
      <Badge accessibilityLabel="Herkese açık" icon={Globe} tone="overlay" />,
    );
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe('Herkese açık');
    expect(style.minWidth).toBe(controlSize.badge);
  });

  it('stays silent to screen readers when its text already says it', () => {
    const { root } = render(<Badge label="Senin listen" tone="primary" />);
    expect(root.props.accessible).toBe(false);
  });
});
