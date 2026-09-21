import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findTypographyViolations } from '../ui-token-typography.mjs';

const DEFAULT_PATH = 'src/mobile/app/features/example/ui/Example.tsx';

function inspect(source, path = DEFAULT_PATH) {
  return findTypographyViolations({
    minFontSize: 12,
    normalizedPath: `C:/repo/${path}`,
    relativePath: path,
    source,
  });
}

describe('UI typography token guard', () => {
  it('rejects numeric and named raw font weights', () => {
    const violations = inspect(`
      const styles = StyleSheet.create({
        numeric: { fontWeight: 700 },
        named: { fontWeight: 'bold' },
        normal: { fontWeight: "normal" },
      });
    `);

    assert.equal(violations.filter((item) => item.includes('raw font weight')).length, 3);
  });

  it('rejects multiline raw metrics and reports unreadably small text', () => {
    const violations = inspect(`
      const styles = StyleSheet.create({
        compact: {
          fontSize:
            10,
          lineHeight:
            14,
        },
      });
    `);

    assert.ok(violations.some((item) => item.includes(':4 text below 12px')));
    assert.ok(violations.some((item) =>
      item.includes(':4 tokenized surface uses a raw type metric')));
    assert.ok(violations.some((item) =>
      item.includes(':6 tokenized surface uses a raw type metric')));
  });

  it('rejects computed values, shorthand properties, and quoted property names', () => {
    const violations = inspect(`
      const fontSize = getFontSize();
      const styles = StyleSheet.create({
        computed: {
          fontSize: baseSize * 0.9,
          lineHeight: getLineHeight(),
          fontWeight: active ? 700 : 400,
          'letterSpacing': tracking,
        },
        shorthand: { fontSize },
      });
    `);

    assert.equal(violations.filter((item) => item.includes('typography tokens')).length, 3);
    assert.equal(violations.filter((item) => item.includes('raw font weight')).length, 1);
    assert.equal(violations.filter((item) => item.includes('raw letter spacing')).length, 1);
  });

  it('accepts semantic typography, weight, and tracking tokens', () => {
    assert.deepEqual(inspect(`
      const styles = StyleSheet.create({
        copy: {
          ...typography.bodyText,
          fontSize: typography.compactBodyText.fontSize,
          lineHeight: typography.compactBodyText.lineHeight,
          fontWeight: fontWeight.strong,
          letterSpacing: letterSpacing.emphasizedMetadata,
        },
      });
    `), []);
  });

  it('sends a scale-plus-colour body to textStyle instead of copying it again', () => {
    const violations = inspect(`
      const styles = StyleSheet.create({
        label: {
          ...typography.metadataText,
          color: colors.textMuted,
        },
        strongLabel: {
          ...typography.metadataText,
          color: colors.primary,
          fontWeight: fontWeight.strong,
        },
      });
    `);

    assert.equal(violations.filter((item) => item.includes('should use textStyle()')).length, 2);
  });

  it('leaves a body that carries more than the composition alone', () => {
    assert.deepEqual(inspect(`
      const styles = StyleSheet.create({
        spread: { ...typography.bodyText, color: colors.text, marginTop: spacing.sm },
        weightOnly: { ...typography.bodyText, fontWeight: fontWeight.strong },
        composed: textStyle('bodyText', colors.text),
      });
    `), []);
  });

  it('keeps only the exact approved responsive metrics allowlisted', () => {
    const logoPath = 'src/mobile/app/shared/components/brand/SoRitaLogo.tsx';
    const avatarPath = 'src/mobile/app/shared/components/ui/AvatarView.tsx';

    assert.deepEqual(inspect(`
      const title = {
        fontSize: textSizes[size],
        lineHeight: textSizes[size] + 2,
      };
    `, logoPath), []);
    assert.deepEqual(inspect('const fallback = { fontSize: size * 0.28 };', avatarPath), []);

    assert.equal(inspect('const copy = { fontSize: textSizes[size] };').length, 1);
    assert.equal(inspect('const title = { fontSize: textSizes[size] + 1 };', logoPath).length, 1);
    assert.equal(inspect('const fallback = { fontSize: size * 0.3 };', avatarPath).length, 1);
  });

  it('fails closed when a typography-bearing source cannot be parsed', () => {
    const violations = inspect('const styles = { copy: { fontSize:');

    assert.ok(violations.length > 0);
    assert.ok(violations.every((item) => item.includes('could not be parsed')));
  });
});
