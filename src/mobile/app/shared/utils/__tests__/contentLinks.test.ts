import { describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    authWebOrigin: 'https://cayankuzu.github.io/SoRita_web/',
  },
}));

import { buildDownloadUrl, buildListContentUrl } from '@/mobile/app/shared/utils/contentLinks';

describe('contentLinks', () => {
  it('builds the download page url from the configured web origin', () => {
    expect(buildDownloadUrl()).toBe('https://cayankuzu.github.io/SoRita_web/download/');
  });

  it('builds list share urls against the static lists page with query params', () => {
    expect(buildListContentUrl('list-42', 'place-7')).toBe(
      'https://cayankuzu.github.io/SoRita_web/lists/?listId=list-42&placeId=place-7',
    );
  });

  it('falls back to the download page when no list id is available', () => {
    expect(buildListContentUrl(null, 'place-7')).toBe(
      'https://cayankuzu.github.io/SoRita_web/download/',
    );
  });
});
