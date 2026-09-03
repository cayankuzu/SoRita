import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const composePath = path.join(repositoryRoot, 'infra/docker/compose.yaml');
const containerMode = process.argv.includes('--container');
const reuseImage = process.env.SORITA_DOCKER_REUSE_IMAGE === '1';

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? 1}).`);
  }
};

if (containerMode) {
  run('node', ['utils/guards/check-docker-context.mjs']);
  run('npm', ['run', 'security:assets']);
  run('npm', ['run', 'security:licenses']);
  run('node', ['--test', 'infra/docker/scripts/build-evidence.test.mjs']);
  process.stdout.write(
    `${JSON.stringify({
      profile: 'security',
      scope: ['build-context', 'asset-parser-boundary', 'license-policy', 'evidence-contract'],
      status: 'pass',
    })}\n`,
  );
  process.exit(0);
}

try {
  run('docker', [
    'compose', '-f', composePath, '--profile', 'security', 'up',
    ...(reuseImage ? [] : ['--build']),
    '--abort-on-container-exit', '--exit-code-from', 'security-runner', 'security-runner',
  ]);
} finally {
  run('docker', [
    'compose', '-f', composePath,
    '--profile', 'quality', '--profile', 'worker', '--profile', 'security',
    'down', '--remove-orphans',
  ]);
}
