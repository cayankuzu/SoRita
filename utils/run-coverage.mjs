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

const result = spawnSync(
  process.execPath,
  [localStorageOption, vitestBin, 'run', '--coverage'].filter(Boolean),
  {
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
