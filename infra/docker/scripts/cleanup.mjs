import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const composePath = path.join(repositoryRoot, 'infra/docker/compose.yaml');
const volumeCleanup = process.argv.includes('--volumes');
const confirmed = process.argv.includes('--confirm=DELETE_TEST_VOLUMES');

if (volumeCleanup && !confirmed) {
  throw new Error('Volume cleanup requires --confirm=DELETE_TEST_VOLUMES.');
}

const run = (args, capture = false) => {
  const result = spawnSync('docker', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) throw new Error(`docker ${args.join(' ')} failed (${result.status ?? 1}).`);
  return result.stdout || '';
};

if (volumeCleanup) {
  const volumes = run([
    'volume', 'ls', '--filter', 'label=com.docker.compose.project=sorita-verification',
    '--format', '{{.Name}}',
  ], true).trim().split(/\r?\n/u).filter(Boolean);
  for (const volume of volumes) {
    assert.match(volume, /^sorita-verification(?:-|_)/u, `Refusing unexpected volume ${volume}`);
  }
}

const downArgs = [
  'compose', '-f', composePath,
  '--profile', 'quality', '--profile', 'worker', '--profile', 'db-tools',
  '--profile', 'security', '--profile', 'test', '--profile', 'resilience', '--profile', 'load',
  'down', '--remove-orphans',
];
if (volumeCleanup) downArgs.push('--volumes');
run(downArgs);

const orphanContainers = run([
  'ps', '--all', '--filter', 'label=com.docker.compose.project=sorita-verification',
  '--format', '{{.ID}}',
], true).trim();
assert.equal(orphanContainers, '', 'Compose cleanup left an orphan container.');

const orphanNetworks = run([
  'network', 'ls', '--filter', 'label=com.docker.compose.project=sorita-verification',
  '--format', '{{.ID}}',
], true).trim();
assert.equal(orphanNetworks, '', 'Compose cleanup left an orphan network.');

process.stdout.write(`${JSON.stringify({ status: 'clean', volumesRemoved: volumeCleanup })}\n`);
