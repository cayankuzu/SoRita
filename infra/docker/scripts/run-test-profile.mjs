import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const composePath = path.join(repositoryRoot, 'infra/docker/compose.yaml');
const flags = new Set(process.argv.slice(2));

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, ...(options.env || {}) },
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
};

const compose = (...args) => run('docker', ['compose', '-f', composePath, ...args]);
const buildArgs = process.env.SORITA_DOCKER_REUSE_IMAGE === '1' ? [] : ['--build'];

if (flags.has('--container')) {
  run('node', ['utils/guards/check-docker-context.mjs']);
  run('node', [
    '--test',
    'infra/docker/mocks/maps-server.test.mjs',
    'infra/docker/scripts/build-evidence.test.mjs',
  ]);
  run('npm', ['--prefix', 'infra/cloudflare/sorita-edge', 'run', 'check']);
  process.exit(0);
}

run('node', ['utils/guards/check-docker-context.mjs']);
run('node', ['infra/docker/scripts/check-compose-contract.mjs']);

if (flags.has('--config-only')) process.exit(0);

if (flags.has('--up-only')) {
  compose('--profile', 'test', 'up', ...buildArgs, '--detach', '--wait', 'maps-mock');
  process.exit(0);
}

try {
  compose(
    '--profile', 'test', 'up', ...buildArgs, '--abort-on-container-exit',
    '--exit-code-from', 'test-runner', 'test-runner',
  );
} finally {
  compose(
    '--profile', 'test', '--profile', 'resilience', '--profile', 'load',
    'down', '--remove-orphans',
  );
}

if (!flags.has('--skip-database')) {
  run('node', ['infra/docker/scripts/run-supabase-validation.mjs']);
}
