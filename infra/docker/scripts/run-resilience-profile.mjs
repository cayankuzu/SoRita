import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const composePath = path.join(repositoryRoot, 'infra/docker/compose.yaml');
const containerMode = process.argv.includes('--container');
const buildArgs = process.env.SORITA_DOCKER_REUSE_IMAGE === '1' ? [] : ['--build'];

const runCompose = (...args) => {
  const result = spawnSync('docker', ['compose', '-f', composePath, ...args], {
    cwd: repositoryRoot,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`Docker resilience profile failed (${result.status ?? 1}).`);
};

if (!containerMode) {
  try {
    runCompose(
      '--profile', 'resilience', 'up', ...buildArgs, '--abort-on-container-exit',
      '--exit-code-from', 'resilience-runner', 'resilience-runner',
    );
  } finally {
    runCompose(
      '--profile', 'test', '--profile', 'resilience', '--profile', 'load',
      'down', '--remove-orphans',
    );
  }
  process.exit(0);
}

const apiUrl = process.env.TOXIPROXY_API_URL;
const proxyHost = process.env.TOXIPROXY_PROXY_HOST;
if (!apiUrl || proxyHost !== 'toxiproxy') {
  throw new Error('The internal Toxiproxy API URL and fixed proxy host are required in container mode.');
}

const origins = [
  {
    method: 'GET',
    name: 'maps-geocoding',
    path: '/maps/api/geocode/json?address=Istanbul',
    port: 8_666,
  },
  {
    method: 'GET',
    name: 'supabase-read',
    path: '/supabase/rest/v1/profiles?select=id,username&limit=20',
    port: 8_667,
  },
  {
    body: { uploadId: 'synthetic-upload-id' },
    method: 'POST',
    name: 'media-finalize',
    path: '/functions/v1/media-upload-finalize',
    port: 8_668,
  },
  {
    body: { eventId: 'synthetic-outbox-event', operation: 'sync' },
    method: 'POST',
    name: 'offline-outbox',
    path: '/functions/v1/offline-outbox',
    port: 8_669,
  },
  {
    body: { audience: 'test', notificationId: 'synthetic-notification' },
    method: 'POST',
    name: 'push-origin',
    path: '/functions/v1/admin-broadcast-notification',
    port: 8_670,
  },
];

const api = async (pathName, init = {}) => {
  const response = await fetch(`${apiUrl}${pathName}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Toxiproxy API ${pathName} returned ${response.status}.`);
  return response;
};

const reset = () => api('/reset', { method: 'POST' });
const addToxic = (origin, name, type, attributes) =>
  api(`/proxies/${encodeURIComponent(origin.name)}/toxics`, {
    method: 'POST',
    body: JSON.stringify({ attributes, name, stream: 'downstream', toxicity: 1, type }),
  });

const proxiedFetch = (origin, mode = 'success', timeout = 3_000) => {
  const separator = origin.path.includes('?') ? '&' : '?';
  return fetch(`http://${proxyHost}:${origin.port}${origin.path}${separator}mode=${mode}`, {
    body: origin.body ? JSON.stringify(origin.body) : undefined,
    headers: origin.body ? { 'content-type': 'application/json' } : undefined,
    method: origin.method,
    redirect: 'error',
    signal: AbortSignal.timeout(timeout),
  });
};

const expectNetworkFailure = async (promise) => {
  await assert.rejects(promise, (error) =>
    ['AbortError', 'TimeoutError', 'TypeError'].includes(error?.name),
  );
};

await api('/populate', {
  method: 'POST',
  body: JSON.stringify(
    origins.map((origin) => ({
      enabled: true,
      listen: `0.0.0.0:${origin.port}`,
      name: origin.name,
      upstream: 'maps-mock:8789',
    })),
  ),
});
await reset();

for (const origin of origins) {
  const baseline = await proxiedFetch(origin);
  assert.equal(baseline.status, 200, `${origin.name} baseline must succeed`);
  assert.match(baseline.headers.get('cache-control') || '', /no-store/u);
  await baseline.arrayBuffer();

  await addToxic(origin, `${origin.name}-latency`, 'latency', { jitter: 0, latency: 1_000 });
  await expectNetworkFailure(proxiedFetch(origin, 'success', 150));
  await reset();

  await addToxic(origin, `${origin.name}-timeout`, 'timeout', { timeout: 250 });
  await expectNetworkFailure(proxiedFetch(origin, 'success', 1_000));
  await reset();

  await addToxic(origin, `${origin.name}-reset-peer`, 'reset_peer', { timeout: 10 });
  await expectNetworkFailure(proxiedFetch(origin, 'success', 1_000));
  await reset();

  await addToxic(origin, `${origin.name}-bandwidth`, 'bandwidth', { rate: 1 });
  await expectNetworkFailure(proxiedFetch(origin, 'large', 250));
  await reset();
}

process.stdout.write(
  `${JSON.stringify({
    faultMatrixSize: origins.length * 4,
    origins: origins.map(({ name }) => name),
    scenarios: ['latency', 'timeout', 'reset_peer', 'bandwidth'],
    status: 'pass',
  })}\n`,
);
