import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { androidNotificationChannelId } from '@/mobile/app/platform/notifications/channels';

const originalEnv = { ...process.env };

async function loadAppConfig() {
  const module = await import('../../../../../../app.config');
  return module.default;
}

function readPlistString(source: string, key: string) {
  const match = source.match(
    new RegExp(`<key>\\s*${key}\\s*</key>\\s*<string>([^<]+)</string>`, 'u'),
  );

  if (!match?.[1]) {
    throw new Error(`Missing ${key} in GoogleService-Info.plist fixture.`);
  }

  return match[1];
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
    process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS = ' TRUE ';

    const config = await loadAppConfig();

    expect(config.extra?.enablePushNotifications).toBe('true');
    warnSpy.mockRestore();
  });

  it('rejects an invalid push notification override instead of silently enabling push', async () => {
    process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS = 'flase';

    await expect(loadAppConfig()).rejects.toThrow(
      'EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS must be true or false.',
    );
  });

  it('keeps the native default notification channel aligned with the app channel', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = await loadAppConfig();
    const notificationsPlugin = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
    );

    expect(notificationsPlugin).toEqual([
      'expo-notifications',
      {
        defaultChannel: androidNotificationChannelId,
        mode: 'development',
      },
    ]);
    expect(androidNotificationChannelId).toBe('sorita-alerts-v5');
    const nativeManifest = readFileSync(
      resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );
    expect(nativeManifest).toContain(
      `android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="${androidNotificationChannelId}"`,
    );
    warnSpy.mockRestore();
  });

  it('keeps Firebase client files and native push capabilities aligned', async () => {
    const config = await loadAppConfig();
    const rootAndroidConfigSource = readFileSync(
      resolve(process.cwd(), 'google-services.json'),
      'utf8',
    );
    const nativeAndroidConfigSource = readFileSync(
      resolve(process.cwd(), 'android/app/google-services.json'),
      'utf8',
    );
    const iosConfigSource = readFileSync(
      resolve(process.cwd(), 'GoogleService-Info.plist'),
      'utf8',
    );
    const androidConfig = JSON.parse(rootAndroidConfigSource) as {
      client?: Array<{
        api_key?: Array<{ current_key?: string }>;
        client_info?: {
          android_client_info?: { package_name?: string };
          mobilesdk_app_id?: string;
        };
      }>;
      project_info?: { project_id?: string; project_number?: string };
    };
    const expectedAndroidClient = androidConfig.client?.find(
      (client) =>
        client.client_info?.android_client_info?.package_name === config.android?.package,
    );

    expect(config.android?.googleServicesFile).toBe('./google-services.json');
    expect(config.android?.permissions).toContain('POST_NOTIFICATIONS');
    expect(nativeAndroidConfigSource === rootAndroidConfigSource).toBe(true);
    expect(expectedAndroidClient?.client_info?.mobilesdk_app_id).toBeTruthy();
    expect(expectedAndroidClient?.api_key?.[0]?.current_key).toBeTruthy();

    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(readPlistString(iosConfigSource, 'BUNDLE_ID')).toBe(config.ios?.bundleIdentifier);
    expect(readPlistString(iosConfigSource, 'PROJECT_ID')).toBe(
      androidConfig.project_info?.project_id,
    );
    expect(readPlistString(iosConfigSource, 'GCM_SENDER_ID')).toBe(
      androidConfig.project_info?.project_number,
    );
    expect(readPlistString(iosConfigSource, 'GOOGLE_APP_ID')).toBeTruthy();
    expect(
      /<key>\s*IS_GCM_ENABLED\s*<\/key>\s*<true(?:\s*\/|>\s*<\/true)>/u.test(
        iosConfigSource,
      ),
    ).toBe(true);
    expect(config.ios?.infoPlist?.UIBackgroundModes).toContain('remote-notification');

    expect(config.plugins).toContain('@react-native-firebase/app');
    expect(config.plugins).toContain('@react-native-firebase/messaging');
    expect(config.plugins).toContainEqual([
      'expo-build-properties',
      expect.objectContaining({
        ios: expect.objectContaining({ useFrameworks: 'static' }),
      }),
    ]);

    const clientConfigSources = `${rootAndroidConfigSource}\n${iosConfigSource}`;
    expect(/"private_key"|"client_email"|service_account/iu.test(clientConfigSources)).toBe(
      false,
    );
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
    process.env.EXPO_PUBLIC_EDGE_API_URL = '  https://api.example.com/  ';
    process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE = 'gateway';
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = 'preview';

    const config = await loadAppConfig();

    expect(config.extra).toMatchObject({
      edgeApiUrl: 'https://api.example.com',
      edgeCutoverMode: 'gateway',
      releaseEnvironment: 'preview',
    });
    expect(config.plugins).toContainEqual([
      'expo-notifications',
      expect.objectContaining({ mode: 'production' }),
    ]);
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

    await expect(loadAppConfig()).rejects.toThrow('Edge API URL must be an HTTPS origin');
  });

  it('rejects gateway URLs with a path the Worker does not route', async () => {
    process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE = 'gateway';
    process.env.EXPO_PUBLIC_EDGE_API_URL = 'https://api.example.com/edge';

    await expect(loadAppConfig()).rejects.toThrow('Edge API URL must be an HTTPS origin');
  });

  it('uses a recognized EAS build profile as release metadata when no override is set', async () => {
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = '';
    process.env.EAS_BUILD_PROFILE = 'production';

    const config = await loadAppConfig();

    expect(config.extra?.releaseEnvironment).toBe('production');
    expect(config.plugins).toContainEqual([
      'expo-notifications',
      expect.objectContaining({ mode: 'production' }),
    ]);
  });
});
