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
const testSuites = [
  ['src/mobile/app/app-shell', 'src/mobile/app/data'],
  { nodeScript: 'utils/run-feature-tests.mjs' },
  ['src/mobile/app/platform', 'src/mobile/app/shared', 'src/shared', 'supabase/functions'],
];

for (const suite of testSuites) {
  const result = Array.isArray(suite)
    ? spawnSync(process.execPath, [localStorageOption, vitestBin, 'run', ...suite].filter(Boolean), {
        env: childEnv,
        stdio: 'inherit',
      })
    : spawnSync(process.execPath, [suite.nodeScript], {
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
