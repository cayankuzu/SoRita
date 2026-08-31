import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { androidNotificationChannelId } from '@/mobile/app/platform/notifications/channels';

const originalEnv = { ...process.env };

async function loadAppConfig() {
  const module = await import('../../../../../../app.config');
  return module.default;
}

describe('app.config push notification extras', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    process.env.EXPO_PUBLIC_EDGE_API_URL = '';
    process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE = 'direct';
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = 'development';
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID = 'b4a62a22-92dd-4867-ab44-f9131d958ed2';
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS;
  });

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('leaves push notifications unset when the env var is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = await loadAppConfig();

    expect(config.extra?.enablePushNotifications).toBeUndefined();
    expect(config.extra?.systemNotificationFcmTopic).toBe('system-all-users-v1');
    warnSpy.mockRestore();
  });

  it('passes through an explicit push notification override', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS = 'true';

    const config = await loadAppConfig();

    expect(config.extra?.enablePushNotifications).toBe('true');
    warnSpy.mockRestore();
  });

  it('keeps the native default notification channel aligned with the app channel', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = await loadAppConfig();
    const notificationsPlugin = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
    );

    expect(notificationsPlugin).toEqual([
      'expo-notifications',
      { defaultChannel: androidNotificationChannelId },
    ]);
    warnSpy.mockRestore();
  });

  it('embeds explicit direct cutover and release metadata by default', async () => {
    const config = await loadAppConfig();

    expect(config.extra).toMatchObject({
      edgeApiUrl: '',
      edgeCutoverMode: 'direct',
      releaseEnvironment: 'development',
    });
  });

  it('normalizes a validated HTTPS gateway URL', async () => {
    process.env.EXPO_PUBLIC_EDGE_API_URL = '  https://api.example.com/edge/  ';
    process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE = 'gateway';
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = 'preview';

    const config = await loadAppConfig();

    expect(config.extra).toMatchObject({
      edgeApiUrl: 'https://api.example.com/edge',
      edgeCutoverMode: 'gateway',
      releaseEnvironment: 'preview',
    });
  });

  it('fails closed when gateway mode has no HTTPS base URL', async () => {
    process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE = 'gateway';
    process.env.EXPO_PUBLIC_EDGE_API_URL = '';

    await expect(loadAppConfig()).rejects.toThrow(
      'Edge API URL is required when gateway cutover mode is enabled.',
    );
  });

  it('rejects insecure gateway URLs', async () => {
    process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE = 'gateway';
    process.env.EXPO_PUBLIC_EDGE_API_URL = 'http://api.example.com';

    await expect(loadAppConfig()).rejects.toThrow('Edge API URL must be an HTTPS base URL');
  });

  it('uses a recognized EAS build profile as release metadata when no override is set', async () => {
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = '';
    process.env.EAS_BUILD_PROFILE = 'production';

    const config = await loadAppConfig();

    expect(config.extra?.releaseEnvironment).toBe('production');
  });
});
