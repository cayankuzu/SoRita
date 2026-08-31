import { describe, expect, it } from 'vitest';

import {
  getPublicRuntimeConfigIssueEnvNames,
  publicRuntimeConfigSchema,
} from '@/mobile/app/platform/config/publicRuntimeConfig';

describe('publicRuntimeConfigSchema', () => {
  it('defaults old binaries to direct development mode', () => {
    expect(publicRuntimeConfigSchema.parse({})).toEqual({
      edgeApiUrl: '',
      edgeCutoverMode: 'direct',
      releaseEnvironment: 'development',
    });
  });

  it('accepts and normalizes explicit gateway configuration', () => {
    expect(publicRuntimeConfigSchema.parse({
      edgeApiUrl: ' https://api.example.com/base/// ',
      edgeCutoverMode: ' GATEWAY ',
      releaseEnvironment: ' PREVIEW ',
    })).toEqual({
      edgeApiUrl: 'https://api.example.com/base',
      edgeCutoverMode: 'gateway',
      releaseEnvironment: 'preview',
    });
  });

  it.each([
    'http://api.example.com',
    'https://user:password@api.example.com',
    'https://api.example.com?secret=value',
    'https://api.example.com/#fragment',
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
});
