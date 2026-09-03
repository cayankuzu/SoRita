import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const composePath = path.join(repositoryRoot, 'infra/docker/compose.yaml');
const profiles = ['quality', 'worker', 'db-tools', 'load', 'security', 'test', 'maps-mock', 'resilience'];
const args = ['compose', '-f', composePath];
for (const profile of profiles) args.push('--profile', profile);
args.push('config', '--format', 'json');

const rendered = spawnSync('docker', args, {
  cwd: repositoryRoot,
  encoding: 'utf8',
  shell: false,
});

if (rendered.status !== 0) {
  process.stderr.write(rendered.stderr || rendered.stdout || 'docker compose config failed\n');
  process.exit(rendered.status || 1);
}

const config = JSON.parse(rendered.stdout);
const longLived = new Set(['maps-mock', 'toxiproxy']);

assert.equal(config.networks?.verification?.internal, true, 'verification network must be internal');

for (const [name, service] of Object.entries(config.services || {})) {
  assert.notEqual(service.privileged, true, `${name} must not be privileged`);
  assert.notEqual(service.network_mode, 'host', `${name} must not use host networking`);
  assert.equal(service.ports, undefined, `${name} must not publish a host port`);
  assert.equal(service.read_only, true, `${name} must use a read-only root filesystem`);
  assert.match(String(service.user || ''), /^\d+:[1-9]\d*$/u, `${name} must set a numeric non-root user`);
  assert.notEqual(String(service.user).split(':')[0], '0', `${name} must not run as UID 0`);
  assert.ok(service.cap_drop?.includes('ALL'), `${name} must drop every Linux capability`);
  assert.ok(
    service.security_opt?.includes('no-new-privileges:true'),
    `${name} must set no-new-privileges`,
  );
  assert.ok(Number(service.pids_limit) > 0, `${name} must have a PID limit`);
  assert.ok(Number(service.mem_limit) > 0, `${name} must have a memory limit`);
  assert.ok(Number(service.cpus) > 0, `${name} must have a CPU limit`);

  const image = service.image || '';
  assert.ok(
    image.startsWith('sorita-tooling:') || /@sha256:[a-f0-9]{64}$/u.test(image),
    `${name} image must be local tooling or immutable-digest pinned`,
  );
  assert.doesNotMatch(image, /:latest(?:@|$)/u, `${name} must not use latest`);

  for (const volume of service.volumes || []) {
    assert.equal(volume.type, 'bind', `${name} may only use explicit read-only bind mounts`);
    assert.equal(volume.read_only, true, `${name} bind mounts must be read-only`);
    assert.notEqual(volume.source, '/var/run/docker.sock', `${name} must not mount Docker socket`);
  }

  if (longLived.has(name)) {
    assert.ok(service.healthcheck?.test, `${name} must declare a real healthcheck`);
  }
}

process.stdout.write(
  `${JSON.stringify({ profiles, services: Object.keys(config.services || {}).sort(), status: 'pass' })}\n`,
);
