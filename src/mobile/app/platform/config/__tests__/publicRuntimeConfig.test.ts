import { describe, expect, it } from 'vitest';

import {
  getPublicRuntimeConfigIssueEnvNames,
  publicRuntimeConfigSchema,
} from '@/mobile/app/platform/config/publicRuntimeConfig';

describe('publicRuntimeConfigSchema', () => {
  it('defaults old binaries to direct development mode', () => {
    expect(publicRuntimeConfigSchema.parse({})).toEqual({
      appLinkDomain: '',
      edgeApiUrl: '',
      edgeCutoverMode: 'direct',
      releaseEnvironment: 'development',
      posthogHost: '',
      productAnalyticsEnabled: false,
    });
  });

  it('accepts and normalizes explicit gateway configuration', () => {
    expect(publicRuntimeConfigSchema.parse({
      appLinkDomain: ' Links.Example.COM ',
      edgeApiUrl: ' https://api.example.com/ ',
      edgeCutoverMode: ' GATEWAY ',
      releaseEnvironment: ' PREVIEW ',
    })).toEqual({
      appLinkDomain: 'links.example.com',
      edgeApiUrl: 'https://api.example.com',
      edgeCutoverMode: 'gateway',
      releaseEnvironment: 'preview',
      posthogHost: '',
      productAnalyticsEnabled: false,
    });
  });

  it('accepts the explicit product analytics runtime settings', () => {
    expect(publicRuntimeConfigSchema.parse({
      posthogHost: ' https://eu.i.posthog.com/ ',
      productAnalyticsEnabled: 'TRUE',
    })).toMatchObject({
      posthogHost: 'https://eu.i.posthog.com',
      productAnalyticsEnabled: true,
    });
  });

  it('rejects an unsafe PostHog host and malformed product analytics switch', () => {
    expect(publicRuntimeConfigSchema.safeParse({
      posthogHost: 'http://posthog.example.test',
    }).success).toBe(false);
    expect(publicRuntimeConfigSchema.safeParse({
      productAnalyticsEnabled: 'yes',
    }).success).toBe(false);
  });

  it.each([
    'https://links.example.com',
    'links.example.com/path',
    'links.example.com:443',
    'user@links.example.com',
    'links.example.com?source=share',
    'localhost',
    'preview.localhost',
  ])('rejects an unsafe app-link domain: %s', (appLinkDomain) => {
    expect(publicRuntimeConfigSchema.safeParse({ appLinkDomain }).success).toBe(false);
  });

  it.each([
    'http://api.example.com',
    'https://user:password@api.example.com',
    'https://api.example.com?secret=value',
    'https://api.example.com/#fragment',
    'https://api.example.com/edge',
    'not-a-url',
  ])('rejects an unsafe gateway base URL: %s', (edgeApiUrl) => {
    const result = publicRuntimeConfigSchema.safeParse({
      edgeApiUrl,
      edgeCutoverMode: 'gateway',
      releaseEnvironment: 'production',
    });

    expect(result.success).toBe(false);
  });

  it('maps validation failures to public environment names', () => {
    const result = publicRuntimeConfigSchema.safeParse({
      edgeCutoverMode: 'gateway',
      releaseEnvironment: 'production',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(getPublicRuntimeConfigIssueEnvNames(result.error)).toEqual([
      'EXPO_PUBLIC_EDGE_API_URL',
    ]);
  });

  it('maps an invalid app-link host to its public environment name', () => {
    const result = publicRuntimeConfigSchema.safeParse({
      appLinkDomain: 'https://links.example.com/path',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(getPublicRuntimeConfigIssueEnvNames(result.error)).toEqual([
      'EXPO_PUBLIC_APP_LINK_DOMAIN',
    ]);
  });
});
