import { beforeEach, describe, expect, it, vi } from 'vitest';

const constantsMock = vi.hoisted(() => ({
  appOwnership: 'standalone',
  easConfig: undefined as { projectId?: string } | undefined,
  expoConfig: {
    extra: {} as Record<string, unknown>,
  },
}));

vi.mock('expo-constants', () => ({
  default: constantsMock,
}));

vi.mock('expo-linking', () => ({
  createURL: (path: string) => `sorita://${path}`,
}));

describe('app-link runtime environment', () => {
  beforeEach(() => {
    vi.resetModules();
    constantsMock.expoConfig.extra = {
      appScheme: 'sorita',
      edgeCutoverMode: 'direct',
      releaseEnvironment: 'development',
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    };
  });

  it('carries a normalized optional app-link host into runtime config', async () => {
    constantsMock.expoConfig.extra.appLinkDomain = ' Links.Example.COM ';

    const { env } = await import('@/mobile/app/platform/config/env');

    expect(env.appLinkDomain).toBe('links.example.com');
    expect(env.hasRequiredStartupConfig).toBe(true);
  });

  it('fails closed when an app-link host bypasses build-time validation', async () => {
    constantsMock.expoConfig.extra.appLinkDomain = 'https://links.example.com/path';

    const { env } = await import('@/mobile/app/platform/config/env');

    expect(env.appLinkDomain).toBe('');
    expect(env.hasRequiredStartupConfig).toBe(false);
    expect(env.missingRequiredStartupEnvVars).toContain('EXPO_PUBLIC_APP_LINK_DOMAIN');
  });
});
