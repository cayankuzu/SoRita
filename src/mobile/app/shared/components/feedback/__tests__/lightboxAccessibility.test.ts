import { describe, expect, it } from 'vitest';

import { getLightboxPositionLabel } from '@/mobile/app/shared/components/feedback/lightboxAccessibility';

describe('getLightboxPositionLabel', () => {
  it('formats a stable X/Y position label', () => {
    expect(getLightboxPositionLabel('Fotoğraf', 1, 4)).toBe('Fotoğraf 2/4');
  });

  it('clamps stale indexes while media collections update', () => {
    expect(getLightboxPositionLabel('Video', -2, 3)).toBe('Video 1/3');
    expect(getLightboxPositionLabel('Video', 9, 3)).toBe('Video 3/3');
    expect(getLightboxPositionLabel('Fotoğraf', 0, 0)).toBe('Fotoğraf 1/1');
  });
});
