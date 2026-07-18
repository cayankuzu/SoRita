import { describe, expect, it } from 'vitest';

import { colors, semanticColors } from '@/mobile/app/shared/theme/tokens';

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function channelToLinear(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(foreground: string, background: string) {
  const left = luminance(foreground);
  const right = luminance(background);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme contrast tokens', () => {
  it('keeps common text and filled-control pairs at WCAG AA contrast', () => {
    const pairs = [
      [colors.text, colors.surface],
      [colors.textMuted, colors.surface],
      [colors.textSoft, colors.surface],
      [colors.onPrimary, colors.primary],
      [colors.onPrimary, colors.secondary],
      [colors.onPrimary, colors.danger],
      [colors.onPrimary, colors.warning],
      [colors.onPrimary, colors.purple],
      [semanticColors.content.primary, semanticColors.surface.card],
      [semanticColors.content.secondary, semanticColors.surface.card],
      [semanticColors.content.muted, semanticColors.surface.card],
      [semanticColors.content.inverse, semanticColors.action.primary],
      [semanticColors.state.dangerText, semanticColors.state.dangerBg],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
