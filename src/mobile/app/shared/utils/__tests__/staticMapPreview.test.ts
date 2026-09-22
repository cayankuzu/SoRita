import { describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({ googleMapsStaticApiKey: 'test-key' }));

vi.mock('@/mobile/app/platform/config/env', () => ({ env: envMock }));

import {
  getStaticMapPreviewWidth,
  toStaticMapColor,
} from '@/mobile/app/shared/utils/staticMapPreview';

describe('getStaticMapPreviewWidth', () => {
  // Measured on a Redmi Note 9 Pro by reading the rendered map box out of a
  // screen capture at two densities. Both showed a 59dp gap, so an estimate
  // that overshoots gets cropped by contentFit: 'cover' and eats the Google
  // attribution at the narrow end.
  it.each([
    { viewport: 393, renderedBox: 334 },
    { viewport: 360, renderedBox: 301 },
  ])('stays inside the box actually laid out at $viewport dp', ({ viewport, renderedBox }) => {
    expect(getStaticMapPreviewWidth(viewport)).toBeLessThanOrEqual(renderedBox);
  });

  it('does not undershoot the box so far that the map is upscaled', () => {
    expect(getStaticMapPreviewWidth(393)).toBeGreaterThanOrEqual(334 - 4);
    expect(getStaticMapPreviewWidth(360)).toBeGreaterThanOrEqual(301 - 4);
  });

  it('clamps a phone too narrow to a usable request', () => {
    expect(getStaticMapPreviewWidth(240)).toBe(240);
    expect(getStaticMapPreviewWidth(100)).toBe(240);
  });

  it('clamps a tablet to the Static Maps request ceiling', () => {
    expect(getStaticMapPreviewWidth(1024)).toBe(480);
  });
});

describe('toStaticMapColor', () => {
  it('rewrites a hex colour into the Static Maps encoding', () => {
    expect(toStaticMapColor('#3b82f6')).toBe('0x3b82f6');
  });

  it('passes a non-hex colour through untouched', () => {
    expect(toStaticMapColor('red')).toBe('red');
  });

  it('falls back to the brand blue when no colour is given', () => {
    expect(toStaticMapColor()).toBe('0x3b82f6');
  });
});
