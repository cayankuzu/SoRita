import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  MANUAL_REVIEW_REQUIRED,
  NATIVE_BUILD_REQUIRED,
  OTA_SAFE,
  classifyChangedFiles,
  classifyChangedFilesDetailed,
} from '../classify-ota-change.mjs';

test('classifies application JavaScript and TypeScript as OTA safe', () => {
  assert.equal(
    classifyChangedFiles(['App.tsx', 'src/mobile/app/features/home/HomeScreen.tsx']),
    OTA_SAFE,
  );
});

test('classifies explicitly runtime-scoped assets as OTA safe', () => {
  assert.equal(classifyChangedFiles(['assets/runtime/empty-state.webp']), OTA_SAFE);
});

test('allows tests alongside a runtime change', () => {
  assert.equal(
    classifyChangedFiles([
      'src/mobile/app/features/auth/login.ts',
      'src/mobile/app/features/auth/__tests__/login.test.ts',
    ]),
    OTA_SAFE,
  );
});

test('requires manual review when changes contain no runtime payload', () => {
  assert.equal(
    classifyChangedFiles(['src/mobile/app/features/auth/__tests__/login.test.ts']),
    MANUAL_REVIEW_REQUIRED,
  );
});

for (const file of [
  'android/app/src/main/AndroidManifest.xml',
  'ios/SoRita/Info.plist',
  'app.config.ts',
  'eas.json',
  'package.json',
  'package-lock.json',
  'plugins/withCustomPermission.js',
  'patches/react-native.patch',
  'assets/splash/launch-splash.png',
  'google-services.json',
  'credentials/release.keystore',
  'tsconfig.json',
]) {
  test(`requires a native build for ${file}`, () => {
    assert.equal(classifyChangedFiles([file]), NATIVE_BUILD_REQUIRED);
  });
}

for (const file of [
  '.github/workflows/ci.yml',
  '.env.example',
  'README.md',
  'infra/cloudflare/worker.ts',
  'quality/feature-surface.snapshot.json',
  'supabase/migrations/20260830000000_example.sql',
  'utils/guards/check-example.mjs',
  'unexpected/runtime-file.rb',
]) {
  test(`fails closed for an unapproved surface: ${file}`, () => {
    assert.equal(classifyChangedFiles([file]), MANUAL_REVIEW_REQUIRED);
  });
}

test('an unknown file blocks an otherwise OTA-safe change', () => {
  assert.equal(
    classifyChangedFiles(['src/mobile/app/AppState.ts', 'README.md']),
    MANUAL_REVIEW_REQUIRED,
  );
});

test('a native file takes precedence over other classifications', () => {
  assert.equal(
    classifyChangedFiles(['src/mobile/app/AppState.ts', 'README.md', 'android/build.gradle']),
    NATIVE_BUILD_REQUIRED,
  );
});

test('empty and malformed paths fail closed', () => {
  assert.equal(classifyChangedFiles([]), MANUAL_REVIEW_REQUIRED);
  assert.equal(classifyChangedFiles(['../src/app.ts']), MANUAL_REVIEW_REQUIRED);
  assert.equal(classifyChangedFiles(['C:\\src\\app.ts']), MANUAL_REVIEW_REQUIRED);
});

test('normalizes Windows separators for repository-relative paths', () => {
  const result = classifyChangedFilesDetailed(['src\\mobile\\app\\AppState.ts']);

  assert.equal(result.status, OTA_SAFE);
  assert.deepEqual(result.runtime, ['src/mobile/app/AppState.ts']);
});

test('CLI stdout is exactly one machine-readable classification', () => {
  const scriptPath = fileURLToPath(new URL('../classify-ota-change.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, '--file', 'src/mobile/app/AppState.ts'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, `${OTA_SAFE}\n`);
});

test('CLI fails closed on unknown arguments', () => {
  const scriptPath = fileURLToPath(new URL('../classify-ota-change.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, '--unknown'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  assert.equal(result.status, 0);
  assert.match(result.stderr, /^\[ota-classifier\]/u);
  assert.equal(result.stdout, `${MANUAL_REVIEW_REQUIRED}\n`);
});
