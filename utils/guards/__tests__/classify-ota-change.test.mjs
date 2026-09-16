import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  MANUAL_REVIEW_REQUIRED,
  NATIVE_BUILD_REQUIRED,
  OTA_SAFE,
  classifyGitRange,
  classifyChangedFiles,
  classifyChangedFilesDetailed,
  packageManifestsDifferOnlyInScripts,
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
  'docs/ota-runtime-and-release.md',
  'infra/cloudflare/worker.ts',
  'quality/feature-surface.snapshot.json',
  'supabase/migrations/20260830000000_example.sql',
  'utils/guards/check-example.mjs',
]) {
  test(`a non-shipping file alone has nothing to publish: ${file}`, () => {
    const result = classifyChangedFilesDetailed([file]);

    assert.equal(result.status, MANUAL_REVIEW_REQUIRED);
    assert.deepEqual(result.support, [file]);
    assert.deepEqual(result.unknown, []);
  });
}

test('non-shipping docs, backend and tooling do not block a runtime change', () => {
  const result = classifyChangedFilesDetailed([
    'src/mobile/app/AppState.ts',
    'README.md',
    'docs/MANUAL_STEPS.md',
    'supabase/functions/media-assets/handler.ts',
    'utils/eas/publish-ota.mjs',
    '.github/workflows/ci.yml',
  ]);

  assert.equal(result.status, OTA_SAFE);
  assert.deepEqual(result.runtime, ['src/mobile/app/AppState.ts']);
  assert.equal(result.support.length, 5);
});

for (const file of ['unexpected/runtime-file.rb', '.npmrc', 'src/mobile/app/notes.md', 'docs.md/x.ts']) {
  test(`fails closed for an unapproved surface: ${file}`, () => {
    assert.equal(classifyChangedFiles([file]), MANUAL_REVIEW_REQUIRED);
  });
}

test('an unknown file blocks an otherwise OTA-safe change', () => {
  assert.equal(
    classifyChangedFiles(['src/mobile/app/AppState.ts', 'unexpected/runtime-file.rb']),
    MANUAL_REVIEW_REQUIRED,
  );
});

test('package.json stays native unless the caller proved only scripts changed', () => {
  const files = ['src/mobile/app/AppState.ts', 'package.json'];

  assert.equal(classifyChangedFiles(files), NATIVE_BUILD_REQUIRED);
  assert.equal(
    classifyChangedFilesDetailed(files, { scriptsOnlyPackageManifest: true }).status,
    OTA_SAFE,
  );
  assert.equal(
    classifyChangedFilesDetailed([...files, 'package-lock.json'], {
      scriptsOnlyPackageManifest: true,
    }).status,
    NATIVE_BUILD_REQUIRED,
  );
});

test('only a scripts-only package.json difference is recognised', () => {
  const base = { name: 'sorita', version: '1.0.107', scripts: { a: 'x' }, dependencies: { expo: '~55' } };

  assert.equal(
    packageManifestsDifferOnlyInScripts(
      JSON.stringify(base),
      JSON.stringify({ ...base, scripts: { a: 'y', b: 'z' } }),
    ),
    true,
  );
  assert.equal(
    packageManifestsDifferOnlyInScripts(
      JSON.stringify(base),
      JSON.stringify({ ...base, version: '1.0.108' }),
    ),
    false,
  );
  assert.equal(
    packageManifestsDifferOnlyInScripts(
      JSON.stringify(base),
      JSON.stringify({ ...base, dependencies: { expo: '~55', 'expo-camera': '~55' } }),
    ),
    false,
  );
  assert.equal(packageManifestsDifferOnlyInScripts('{', JSON.stringify(base)), false);
  assert.equal(packageManifestsDifferOnlyInScripts('[]', '[]'), false);
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

test('a git range with a scripts-only package.json change stays OTA safe', () => {
  const repo = mkdtempSync(join(tmpdir(), 'sorita-ota-classifier-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const writeManifest = (manifest) =>
    writeFileSync(join(repo, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  try {
    git('init', '--quiet');
    git('config', 'user.email', 'classifier@example.invalid');
    git('config', 'user.name', 'classifier');
    git('config', 'commit.gpgsign', 'false');
    mkdirSync(join(repo, 'src'));
    writeManifest({ name: 'fixture', version: '1.0.0', scripts: { test: 'a' } });
    writeFileSync(join(repo, 'src/app.ts'), 'export const value = 1;\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'binary');
    const base = git('rev-parse', 'HEAD');

    writeManifest({ name: 'fixture', version: '1.0.0', scripts: { test: 'b' } });
    writeFileSync(join(repo, 'src/app.ts'), 'export const value = 2;\n');
    git('commit', '--quiet', '-am', 'ota');
    assert.equal(classifyGitRange(base, 'HEAD', repo).status, OTA_SAFE);

    writeManifest({ name: 'fixture', version: '1.0.1', scripts: { test: 'b' } });
    git('commit', '--quiet', '-am', 'native');
    assert.equal(classifyGitRange(base, 'HEAD', repo).status, NATIVE_BUILD_REQUIRED);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
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
