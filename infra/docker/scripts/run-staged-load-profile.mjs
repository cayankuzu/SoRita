import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const loadScriptDirectory = path.join(repositoryRoot, 'tests/load');
const confirmation = 'STAGING_ONLY_NO_PRODUCTION';
const allowedTargets = new Set([25, 250, 1_000, 10_000]);
const productionProjectRef = 'csidemtcbvtcmmjextey';
const requiredEnvironment = [
  'SORITA_SUPABASE_URL',
  'SORITA_SUPABASE_PUBLISHABLE_KEY',
  'SORITA_LOAD_TEST_IDENTITIES',
  'SORITA_LOAD_TARGET_VUS',
];

if (process.env.SORITA_STAGED_LOAD_CONFIRM !== confirmation) {
  throw new Error(`Staged load requires SORITA_STAGED_LOAD_CONFIRM=${confirmation}.`);
}

for (const name of requiredEnvironment) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for staged load.`);
}

const targetUrl = new URL(process.env.SORITA_SUPABASE_URL);
if (
  targetUrl.protocol !== 'https:'
  || targetUrl.username
  || targetUrl.password
  || targetUrl.pathname !== '/'
  || targetUrl.search
  || targetUrl.hash
) {
  throw new Error('SORITA_SUPABASE_URL must be a bare HTTPS staging origin.');
}
if (targetUrl.hostname === `${productionProjectRef}.supabase.co`) {
  throw new Error('The staged load guard refuses the production SoRita project.');
}

const targetVUs = Number(process.env.SORITA_LOAD_TARGET_VUS);
if (!allowedTargets.has(targetVUs)) {
  throw new Error('SORITA_LOAD_TARGET_VUS must be one of 25, 250, 1000, or 10000.');
}
if (targetVUs === 10_000 && !process.env.SORITA_PROVIDER_LOAD_APPROVAL_ID?.trim()) {
  throw new Error('The 10000-VU stage requires a provider load-approval reference.');
}

const args = [
  'run', '--rm', '--read-only', '--cap-drop=ALL',
  '--security-opt=no-new-privileges', '--pids-limit=128', '--memory=512m', '--cpus=2',
  '--user=12345:12345', '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m',
  '--label=com.sorita.scope=staging-load',
  '--volume', `${loadScriptDirectory}:/scripts:ro`,
  ...requiredEnvironment.flatMap((name) => ['--env', name]),
  ...(process.env.SORITA_PROVIDER_LOAD_APPROVAL_ID ? ['--env', 'SORITA_PROVIDER_LOAD_APPROVAL_ID'] : []),
  'grafana/k6:2.2.0@sha256:9bd01d6941fca969cb61bb57d2da5ee9b385fe2aa8881df3798c196564d6ace6',
  'run', '/scripts/read-models.k6.js',
];

const result = spawnSync('docker', args, {
  cwd: repositoryRoot,
  shell: false,
  stdio: 'inherit',
});
if (result.status !== 0) {
  throw new Error(`Staged k6 profile failed (${result.status ?? 1}).`);
}
