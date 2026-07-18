import { beforeEach, describe, expect, it, vi } from 'vitest';

const openURLMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('react-native', () => ({
  Linking: {
    openURL: openURLMock,
  },
}));

import {
  isSafeExternalUrl,
  normalizeExternalUrlCandidate,
  normalizeSafeExternalUrl,
  openSafeExternalUrl,
} from '@/mobile/app/shared/utils/safeLinks';

describe('safeLinks', () => {
  beforeEach(() => {
    openURLMock.mockClear();
  });

  it('normalizes only safe public https urls', () => {
    expect(normalizeSafeExternalUrl('https://www.youtube.com/watch?v=abc')).toBe(
      'https://www.youtube.com/watch?v=abc',
    );
    expect(normalizeSafeExternalUrl('www.instagram.com/p/abc')).toBe(
      'https://www.instagram.com/p/abc',
    );
    expect(normalizeSafeExternalUrl('https://uc.com.tr/menu?category_id=123')).toBe(
      'https://uc.com.tr/menu?category_id=123',
    );
    expect(normalizeSafeExternalUrl('http://youtube.com/watch?v=abc')).toBeNull();
    expect(normalizeSafeExternalUrl('https://localhost/test')).toBeNull();
    expect(normalizeSafeExternalUrl('https://192.168.1.20/menu')).toBeNull();
    expect(normalizeSafeExternalUrl('https://xn--googl-fsa.com')).toBeNull();
    expect(normalizeSafeExternalUrl('javascript:alert(1)')).toBeNull();
  });

  it('keeps candidate normalization separate from the public-host safety decision', () => {
    expect(normalizeExternalUrlCandidate('www.tiktok.com/@sorita')).toBe(
      'https://www.tiktok.com/@sorita',
    );
    expect(normalizeExternalUrlCandidate('example.com/menu')).toBe(
      'https://example.com/menu',
    );
    expect(normalizeExternalUrlCandidate('javascript:alert(1)')).toBeNull();
    expect(isSafeExternalUrl('https://www.facebook.com/some-page')).toBe(true);
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('https://127.0.0.1/private')).toBe(false);
  });

  it('opens safe urls and blocks unsafe ones', async () => {
    await expect(openSafeExternalUrl('https://www.google.com/maps/search/?api=1')).resolves.toBe(
      true,
    );
    expect(openURLMock).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1');

    await expect(openSafeExternalUrl('https://10.0.0.5/admin')).resolves.toBe(false);
    expect(openURLMock).toHaveBeenCalledTimes(1);
  });
});
