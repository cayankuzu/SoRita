import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  'docker:config',
  'docker:quality',
  'docker:worker',
  'docker:db-tools',
  'docker:supabase:verify',
  'docker:resilience',
  'docker:load:smoke',
  'docker:security',
];

try {
  for (const step of steps) {
    const result = spawnSync(npmCommand, ['run', step], {
      cwd: repositoryRoot,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error(`${step} failed (${result.status ?? 1}).`);
    }
  }
  process.stdout.write(`${JSON.stringify({ profile: 'docker:verify', status: 'pass', steps })}\n`);
} finally {
  spawnSync(npmCommand, ['run', 'docker:down'], {
    cwd: repositoryRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
}
