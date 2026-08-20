import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const vitestBin = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const localStorageFile = join(tmpdir(), 'sorita-vitest-localstorage.json');
const coverageTempDirectory = join(process.cwd(), 'coverage', '.tmp');
const localStorageOption = process.allowedNodeEnvironmentFlags.has('--localstorage-file')
  ? `--localstorage-file=${localStorageFile}`
  : null;
const nodeOptions = [
  process.env.NODE_OPTIONS,
  localStorageOption,
].filter(Boolean).join(' ');

rmSync(coverageTempDirectory, { force: true, recursive: true });
mkdirSync(coverageTempDirectory, { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    localStorageOption,
    vitestBin,
    'run',
    '--pool=threads',
    '--coverage',
    '--coverage.clean=false',
  ].filter(Boolean),
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
