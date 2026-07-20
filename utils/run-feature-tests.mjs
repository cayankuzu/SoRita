import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const vitestBin = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const localStorageFile = join(tmpdir(), 'sorita-vitest-localstorage.json');
const localStorageOption = process.allowedNodeEnvironmentFlags.has('--localstorage-file')
  ? `--localstorage-file=${localStorageFile}`
  : null;
const nodeOptions = [
  process.env.NODE_OPTIONS,
  localStorageOption,
].filter(Boolean).join(' ');
const childEnv = { ...process.env, NODE_OPTIONS: nodeOptions };
const featureSuites = [
  ['src/mobile/app/features/auth'],
  ['src/mobile/app/features/explore'],
  ['src/mobile/app/features/home'],
  ['src/mobile/app/features/lists'],
  ['src/mobile/app/features/map'],
  ['src/mobile/app/features/notifications'],
  ['src/mobile/app/features/places'],
  ['src/mobile/app/features/profile'],
  ['src/mobile/app/features/settings'],
  ['src/mobile/app/features/social'],
];

for (const suiteArgs of featureSuites) {
  const result = spawnSync(process.execPath, [localStorageOption, vitestBin, 'run', ...suiteArgs].filter(Boolean), {
    env: childEnv,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
