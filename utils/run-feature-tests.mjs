import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
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
// Read from disk: a hand-kept list had silently left out `discovery`, so its
// tests ran only under coverage and never under `npm run test`.
const featuresRoot = 'src/mobile/app/features';
const featureSuites = readdirSync(featuresRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => [`${featuresRoot}/${entry.name}`]);

for (const suiteArgs of featureSuites) {
  const result = spawnSync(process.execPath, [
    localStorageOption,
    vitestBin,
    'run',
    '--configLoader',
    'runner',
    ...suiteArgs,
  ].filter(Boolean), {
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
