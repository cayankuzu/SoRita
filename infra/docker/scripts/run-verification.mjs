import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
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

const runNpmScript = (script) => {
  const npmArgs = ['run', script];
  const npmCliPath = process.env.npm_execpath || (
    process.platform === 'win32'
      ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
      : null
  );
  if (npmCliPath) {
    return spawnSync(process.execPath, [npmCliPath, ...npmArgs], {
      cwd: repositoryRoot,
      shell: false,
      stdio: 'inherit',
    });
  }

  return spawnSync('npm', npmArgs, {
    cwd: repositoryRoot,
    shell: false,
    stdio: 'inherit',
  });
};

try {
  for (const step of steps) {
    const result = runNpmScript(step);
    if (result.status !== 0) {
      throw new Error(`${step} failed (${result.status ?? 1}).`);
    }
  }
  process.stdout.write(`${JSON.stringify({ profile: 'docker:verify', status: 'pass', steps })}\n`);
} finally {
  runNpmScript('docker:down');
}
