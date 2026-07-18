import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const vitestBin = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const localStorageFile = join(tmpdir(), 'sorita-vitest-localstorage.json');
const nodeOptions = [
  process.env.NODE_OPTIONS,
  `--localstorage-file=${localStorageFile}`,
].filter(Boolean).join(' ');
const childEnv = { ...process.env, NODE_OPTIONS: nodeOptions };
const featureSuites = [
  ['--passWithNoTests', 'src/mobile/app/features/auth'],
  ['--passWithNoTests', 'src/mobile/app/features/discovery'],
  ['--passWithNoTests', 'src/mobile/app/features/explore'],
  ['--passWithNoTests', 'src/mobile/app/features/home'],
  ['--passWithNoTests', 'src/mobile/app/features/lists'],
  ['--passWithNoTests', 'src/mobile/app/features/map'],
  ['--passWithNoTests', 'src/mobile/app/features/notifications'],
  ['--passWithNoTests', 'src/mobile/app/features/places'],
  ['--passWithNoTests', 'src/mobile/app/features/profile'],
  ['--passWithNoTests', 'src/mobile/app/features/settings'],
  ['--passWithNoTests', 'src/mobile/app/features/social'],
];

for (const suiteArgs of featureSuites) {
  const result = spawnSync(process.execPath, [`--localstorage-file=${localStorageFile}`, vitestBin, 'run', ...suiteArgs], {
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
