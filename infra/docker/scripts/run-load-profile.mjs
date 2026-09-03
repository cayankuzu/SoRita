import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const composePath = path.join(repositoryRoot, 'infra/docker/compose.yaml');
const buildArgs = process.env.SORITA_DOCKER_REUSE_IMAGE === '1' ? [] : ['--build'];

const compose = (...args) => {
  const result = spawnSync('docker', ['compose', '-f', composePath, ...args], {
    cwd: repositoryRoot,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`Docker load profile failed (${result.status ?? 1}).`);
};

try {
  compose(
    '--profile', 'load', 'up', ...buildArgs, '--abort-on-container-exit',
    '--exit-code-from', 'load-runner', 'load-runner',
  );
} finally {
  compose(
    '--profile', 'test', '--profile', 'resilience', '--profile', 'load',
    'down', '--remove-orphans',
  );
}
