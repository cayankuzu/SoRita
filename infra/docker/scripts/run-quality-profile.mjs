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
  run('npm', ['run', 'lint']);
  run('npm', ['run', 'typecheck']);
  run('npm', ['run', 'test']);
  process.stdout.write(`${JSON.stringify({ profile: 'quality', status: 'pass' })}\n`);
  process.exit(0);
}

const composeArgs = [
  'compose', '-f', composePath, '--profile', 'quality', 'up',
  ...(reuseImage ? [] : ['--build']),
  '--abort-on-container-exit', '--exit-code-from', 'quality-runner', 'quality-runner',
];

try {
  run('docker', composeArgs);
} finally {
  run('docker', [
    'compose', '-f', composePath,
    '--profile', 'quality', '--profile', 'worker', '--profile', 'security',
    'down', '--remove-orphans',
  ]);
}
