import { describe, expect, it } from 'vitest';

import { colors, semanticColors, typography } from '@/mobile/app/shared/theme/tokens';

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

// Every opaque surface a screen can paint content on. A content colour that
// clears AA here clears it wherever the token is actually used, so screens do
// not have to re-derive the pairing by hand.
const opaqueSurfaces = {
  canvas: semanticColors.surface.canvas,
  card: semanticColors.surface.card,
  subtle: semanticColors.surface.subtle,
  raised: semanticColors.surface.raised,
} as const;

const AA_NORMAL_TEXT = 4.5;

describe('theme contrast tokens', () => {
  it('keeps every readable content role at AA on every surface', () => {
    // `disabled` is deliberately excluded: WCAG 1.4.3 exempts inactive
    // controls, and lifting it to AA would make disabled indistinguishable
    // from enabled. It is pinned separately below.
    const readableContent = {
      primary: semanticColors.content.primary,
      secondary: semanticColors.content.secondary,
      muted: semanticColors.content.muted,
    } as const;

    const failures: string[] = [];
    for (const [role, foreground] of Object.entries(readableContent)) {
      for (const [surface, background] of Object.entries(opaqueSurfaces)) {
        const ratio = contrastRatio(foreground, background);
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(`content.${role} on surface.${surface} = ${ratio.toFixed(2)}:1`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps status text readable on its own status background', () => {
    const statusPairs = [
      [semanticColors.state.infoText, semanticColors.state.infoBg],
      [semanticColors.state.successText, semanticColors.state.successBg],
      [semanticColors.state.warningText, semanticColors.state.warningBg],
      [semanticColors.state.dangerText, semanticColors.state.dangerBg],
      [semanticColors.state.purpleText, semanticColors.state.purpleBg],
    ] as const;

    for (const [foreground, background] of statusPairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it('keeps inverse labels readable on every filled control', () => {
    const filledControls = [
      colors.primary,
      colors.primaryDark,
      colors.secondary,
      colors.danger,
      colors.warning,
      colors.purple,
    ] as const;

    for (const background of filledControls) {
      expect(contrastRatio(colors.onPrimary, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it('keeps disabled content visibly weaker than the readable ramp', () => {
    // The exemption only holds while disabled still *reads* as disabled; if
    // this ever inverts, a disabled control would look enabled.
    const disabledRatio = contrastRatio(semanticColors.content.disabled, colors.surface);
    const mutedRatio = contrastRatio(semanticColors.content.muted, colors.surface);

    expect(disabledRatio).toBeLessThan(mutedRatio);
  });

  it('ships no type token below the 12px readability floor', () => {
    const undersized = Object.entries(typography)
      .filter(([, value]) => typeof value === 'object' && value !== null)
      .filter(([, value]) => (value as { fontSize: number }).fontSize < 12)
      .map(([name]) => name);

    expect(undersized).toEqual([]);
  });

  it('gives every type token a line height with room to breathe', () => {
    // Turkish stacks diacritics (ğ, ş, ı, İ) that clip when leading is tight;
    // 1.25x is the floor at which descenders and the dotted capital survive.
    const tight = Object.entries(typography)
      .filter(([, value]) => typeof value === 'object' && value !== null)
      .map(([name, value]) => [name, value as { fontSize: number; lineHeight: number }] as const)
      .filter(([, value]) => value.lineHeight / value.fontSize < 1.25)
      .map(([name, value]) => `${name} (${value.lineHeight}/${value.fontSize})`);

    expect(tight).toEqual([]);
  });
});
