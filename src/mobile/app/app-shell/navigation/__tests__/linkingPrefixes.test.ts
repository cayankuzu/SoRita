import { describe, expect, it } from 'vitest';

import {
  buildNavigationLinkingPrefixes,
  isSafeLinkPath,
} from '@/mobile/app/app-shell/navigation/linkingPrefixes';

describe('buildNavigationLinkingPrefixes', () => {
  it('keeps the custom scheme as the only development fallback', () => {
    expect(buildNavigationLinkingPrefixes('sorita', '')).toEqual(['sorita://']);
  });

  it('adds the canonical HTTPS prefix when an app-link host is configured', () => {
    expect(buildNavigationLinkingPrefixes('sorita', 'links.example.com')).toEqual([
      'sorita://',
      'https://links.example.com',
    ]);
  });
});

describe('isSafeLinkPath', () => {
  it('lets well-formed links through, escapes and all', () => {
    expect(isSafeLinkPath('lists/abc-123')).toBe(true);
    expect(isSafeLinkPath('lists/abc?placeId=p%C3%BC&from=share')).toBe(true);
    expect(isSafeLinkPath('auth/callback#access_token=a.b.c&type=recovery')).toBe(true);
  });

  it('refuses links whose escapes do not decode', () => {
    expect(isSafeLinkPath('lists/abc?x=%')).toBe(false);
    expect(isSafeLinkPath('lists/abc?x=%zz')).toBe(false);
    expect(isSafeLinkPath(`lists/abc?x=${'%E0%A4%A'.repeat(40)}`)).toBe(false);
  });
});
