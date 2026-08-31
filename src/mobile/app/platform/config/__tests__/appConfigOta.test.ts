import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };
const projectId = 'b4a62a22-92dd-4867-ab44-f9131d958ed2';

async function loadAppConfig() {
  const module = await import('../../../../../../app.config');
  return module.default;
}

describe('app.config EAS Update safety', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    process.env.EXPO_PUBLIC_EDGE_API_URL = '';
    process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE = 'direct';
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = 'preview';
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID = projectId;
    delete process.env.EAS_BUILD_PROFILE;
  });

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('derives the update URL and keeps the app-version runtime policy', async () => {
    const config = await loadAppConfig();

    expect(config.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(config.updates).toEqual({
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      useEmbeddedUpdate: true,
      url: `https://u.expo.dev/${projectId}`,
    });
  });

  it('keeps package identities and native build numbers unchanged', async () => {
    const config = await loadAppConfig();

    expect(config).toMatchObject({
      scheme: 'sorita',
      version: '1.0.101',
      android: {
        package: 'com.cayan.sorita.socialmap',
      versionCode: 106,
      },
      ios: {
        bundleIdentifier: 'com.cayan.sorita.socialmap',
      buildNumber: '86',
      },
    });
  });

  it('keeps committed Android metadata and EAS build channels in parity', async () => {
    const manifest = readFileSync(
      resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );
    const androidStrings = readFileSync(
      resolve(process.cwd(), 'android/app/src/main/res/values/strings.xml'),
      'utf8',
    );
    const easConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'eas.json'), 'utf8'),
    ) as {
      build: Record<string, { channel?: string; environment?: string }>;
    };

    expect(manifest).toContain(
      'android:name="expo.modules.updates.ENABLED" android:value="true"',
    );
    expect(manifest).toContain('android:name="expo.modules.updates.EXPO_UPDATE_URL"');
    expect(manifest).toContain('android:name="expo.modules.updates.EXPO_RUNTIME_VERSION"');
    expect(androidStrings).toContain('>1.0.101</string>');
    expect(androidStrings).toContain(`>https://u.expo.dev/${projectId}</string>`);
    expect(easConfig.build).toMatchObject({
      development: { channel: 'development', environment: 'development' },
      preview: { channel: 'preview', environment: 'preview' },
      production: { channel: 'production', environment: 'production' },
    });
  });

  it('disables updates when development has no project ID', async () => {
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = 'development';
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID = '';

    const config = await loadAppConfig();

    expect(config.updates).toMatchObject({
      enabled: false,
      useEmbeddedUpdate: true,
    });
    expect(config.updates).not.toHaveProperty('url');
  });

  it('fails closed when production has no project ID', async () => {
    process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT = 'production';
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID = '';

    await expect(loadAppConfig()).rejects.toThrow(
      'EXPO_PUBLIC_EXPO_PROJECT_ID is required for production.',
    );
  });

  it('rejects a malformed project ID instead of constructing an unsafe URL', async () => {
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID = 'not/a/project-id';

    await expect(loadAppConfig()).rejects.toThrow(
      'EXPO_PUBLIC_EXPO_PROJECT_ID must be a UUID.',
    );
  });
});
