import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PUBLIC_WEBSITE_URL } from '@/mobile/app/platform/config/publicWebsite';

describe('PUBLIC_WEBSITE_URL', () => {
  it('is the site Supabase sends auth links to', () => {
    const config = readFileSync(join(process.cwd(), 'supabase/config.toml'), 'utf8');
    const siteUrl = config.match(/^site_url\s*=\s*"([^"]+)"/m)?.[1];

    expect(siteUrl?.replace(/\/+$/, '')).toBe(PUBLIC_WEBSITE_URL);
  });

  it('is an HTTPS address without a trailing slash, query or fragment', () => {
    const url = new URL(PUBLIC_WEBSITE_URL);

    expect(url.protocol).toBe('https:');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(PUBLIC_WEBSITE_URL.endsWith('/')).toBe(false);
  });
});
