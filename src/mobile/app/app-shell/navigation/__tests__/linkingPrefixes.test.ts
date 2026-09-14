import { describe, expect, it } from 'vitest';

import { buildNavigationLinkingPrefixes } from '@/mobile/app/app-shell/navigation/linkingPrefixes';

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
