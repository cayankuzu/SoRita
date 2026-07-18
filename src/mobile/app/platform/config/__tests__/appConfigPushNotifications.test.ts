import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});
