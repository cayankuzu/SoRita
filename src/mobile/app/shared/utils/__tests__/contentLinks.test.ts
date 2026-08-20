import { describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    appScheme: 'sorita',
  },
}));

import { buildDownloadUrl, buildListContentUrl } from '@/mobile/app/shared/utils/contentLinks';

describe('contentLinks', () => {
  it('builds the app root url from the configured mobile scheme', () => {
    expect(buildDownloadUrl()).toBe('sorita://');
  });

  it('builds list share urls that route directly into the mobile app', () => {
    expect(buildListContentUrl('list-42', 'place-7')).toBe(
      'sorita://lists/list-42?placeId=place-7',
    );
  });

  it('falls back to the app root when no list id is available', () => {
    expect(buildListContentUrl(null, 'place-7')).toBe('sorita://');
  });

  it('encodes route and query values', () => {
    expect(buildListContentUrl('list/42', 'place & 7')).toBe(
      'sorita://lists/list%2F42?placeId=place%20%26%207',
    );
  });
});
