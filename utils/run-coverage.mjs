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

const result = spawnSync(
  process.execPath,
  [`--localstorage-file=${localStorageFile}`, vitestBin, 'run', '--coverage'],
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
