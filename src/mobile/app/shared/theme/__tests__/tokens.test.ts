import { describe, expect, it } from 'vitest';

import {
  colors,
  elevation,
  iconSize,
  letterSpacing,
  radius,
  spacing,
  typography,
} from '@/mobile/app/shared/theme/tokens';

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
  canvas: colors.background,
  card: colors.surface,
  subtle: colors.surfaceMuted,
} as const;

const AA_NORMAL_TEXT = 4.5;

describe('theme contrast tokens', () => {
  it('keeps every readable content role at AA on every surface', () => {
    // `disabled` is deliberately excluded: WCAG 1.4.3 exempts inactive
    // controls, and lifting it to AA would make disabled indistinguishable
    // from enabled. It is pinned separately below.
    const readableContent = {
      primary: colors.text,
      secondary: colors.textMuted,
      muted: colors.textSoft,
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
      [colors.primaryDark, colors.primaryBg],
      [colors.secondary, colors.successBg],
      [colors.warning, colors.warningBg],
      [colors.danger, colors.dangerBg],
      [colors.purple, colors.purpleBg],
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
    const disabledRatio = contrastRatio(colors.textDisabled, colors.surface);
    const mutedRatio = contrastRatio(colors.textSoft, colors.surface);

    expect(disabledRatio).toBeLessThan(mutedRatio);
  });

  it('sets shadow strength once, with an opaque ink', () => {
    // A translucent shadowColor multiplied by shadowOpacity left every iOS
    // shadow at about 2%, invisible. The ink stays opaque; opacity is the dial.
    for (const level of Object.values(elevation)) {
      expect(level.shadowColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(level.shadowOpacity).toBeGreaterThan(0.04);
    }
  });

  it('ships no type token below the 11px readability floor', () => {
    // 11 is Material's label-small and iOS's caption 2: the smallest size
    // either platform sets text at.
    const undersized = Object.entries(typography)
      .filter(([, value]) => typeof value === 'object' && value !== null)
      .filter(([, value]) => (value as { fontSize: number }).fontSize < 11)
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

  it('keeps the type scale to seven sizes with no in-between steps', () => {
    const sizes = new Set(
      Object.values(typography).flatMap((value) =>
        typeof value === 'object' && value !== null ? [value.fontSize] : [],
      ),
    );

    expect([...sizes].sort((a, b) => a - b)).toEqual([11, 13, 15, 17, 19, 22, 26]);
  });

  it('puts spacing and radius on a 4pt grid and icons on a 2pt grid', () => {
    const offGrid = [
      ...Object.entries(spacing).filter(([name]) => name !== 'xxs'),
      ...Object.entries(radius).filter(([name]) => name !== 'pill'),
    ].filter(([, value]) => value % 4 !== 0);
    // Material draws glyphs at 18 and 22 as well as 16 and 24.
    const offGridIcons = Object.entries(iconSize).filter(([, value]) => value % 2 !== 0);

    expect(offGrid).toEqual([]);
    expect(offGridIcons).toEqual([]);
  });

  it('keeps compatibility font-size aliases tied to semantic styles', () => {
    expect(typography.screenTitle).toBe(typography.title.fontSize);
    expect(typography.sectionTitle).toBe(typography.section.fontSize);
    expect(typography.body).toBe(typography.bodyText.fontSize);
    expect(typography.caption).toBe(typography.captionText.fontSize);
  });

  it('preserves compact and headline roles without ad hoc screen metrics', () => {
    expect(typography.headlineText).toMatchObject({
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
    });
    expect(typography.compactTitleText).toMatchObject({
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
    });
    expect(typography.compactBodyText).toMatchObject({
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '400',
    });
    expect(typography.inputText).toMatchObject({
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '400',
    });
    expect(typography.readingBodyText.lineHeight).toBeGreaterThan(
      typography.bodyText.lineHeight,
    );
  });

  it('keeps the approved tracking values centralized', () => {
    expect(letterSpacing).toEqual({
      brandTitle: -0.8,
      brandTagline: 0.4,
      emphasizedMetadata: 0.1,
    });
  });
});
