import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  appLinkDomain: '',
  appScheme: 'sorita',
  publicWebUrl: '',
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: envMock,
}));

import { buildDownloadUrl, buildListContentUrl } from '@/mobile/app/shared/utils/contentLinks';

describe('contentLinks', () => {
  beforeEach(() => {
    envMock.appLinkDomain = '';
    envMock.appScheme = 'sorita';
    envMock.publicWebUrl = '';
  });

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

  it('shares a clickable link to the website handoff page before app links exist', () => {
    envMock.publicWebUrl = 'https://cayankuzu.github.io/SoRita_web';

    expect(buildDownloadUrl()).toBe('https://cayankuzu.github.io/SoRita_web/download/');
    expect(buildListContentUrl('list-42', 'place-7')).toBe(
      'https://cayankuzu.github.io/SoRita_web/lists/?listId=list-42&placeId=place-7',
    );
    expect(buildListContentUrl('list 42')).toBe(
      'https://cayankuzu.github.io/SoRita_web/lists/?listId=list%2042',
    );
  });

  it('prefers the configured canonical HTTPS host for shared content', () => {
    envMock.publicWebUrl = 'https://cayankuzu.github.io/SoRita_web';
    envMock.appLinkDomain = 'links.example.com';

    expect(buildDownloadUrl()).toBe('https://links.example.com');
    expect(buildListContentUrl('list-42', 'place-7')).toBe(
      'https://links.example.com/lists/list-42?placeId=place-7',
    );
  });
});
