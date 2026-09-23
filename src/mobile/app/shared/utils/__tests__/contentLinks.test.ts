import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  appLinkDomain: '',
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: envMock,
}));

import { PUBLIC_WEBSITE_URL } from '@/mobile/app/platform/config/publicWebsite';
import { buildDownloadUrl, buildListContentUrl } from '@/mobile/app/shared/utils/contentLinks';

describe('contentLinks', () => {
  beforeEach(() => {
    envMock.appLinkDomain = '';
  });

  it('shares a clickable link to the website handoff page before app links exist', () => {
    expect(buildDownloadUrl()).toBe(`${PUBLIC_WEBSITE_URL}/download/`);
    expect(buildListContentUrl('list-42', 'place-7')).toBe(
      `${PUBLIC_WEBSITE_URL}/lists/?listId=list-42&placeId=place-7`,
    );
    expect(buildListContentUrl('list-42')).toBe(`${PUBLIC_WEBSITE_URL}/lists/?listId=list-42`);
  });

  it('falls back to the download page when no list id is available', () => {
    expect(buildListContentUrl(null, 'place-7')).toBe(`${PUBLIC_WEBSITE_URL}/download/`);
  });

  it('encodes query values', () => {
    expect(buildListContentUrl('list/42', 'place & 7')).toBe(
      `${PUBLIC_WEBSITE_URL}/lists/?listId=list%2F42&placeId=place%20%26%207`,
    );
  });

  it('prefers the configured canonical HTTPS host for shared content', () => {
    envMock.appLinkDomain = 'links.example.com';

    expect(buildDownloadUrl()).toBe('https://links.example.com');
    expect(buildListContentUrl('list-42', 'place-7')).toBe(
      'https://links.example.com/lists/list-42?placeId=place-7',
    );
    expect(buildListContentUrl('list/42')).toBe('https://links.example.com/lists/list%2F42');
  });
});
