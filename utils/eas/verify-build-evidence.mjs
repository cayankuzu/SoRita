#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_PATTERN = /^[0-9a-f]{40}$/iu;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

function fail(message) {
  throw new Error(message);
}

export function parseEvidence(value) {
  const match = value?.match(
    /^android=([^;]+);ios=([^;]+);runtime=([^;]+);source=([^;]+)$/u,
  );
  if (!match) fail('Binary evidence must use android=<id>;ios=<id>;runtime=<version>;source=<sha>.');
  const [, androidId, iosId, runtimeVersion, sourceSha] = match;
  if (!UUID_PATTERN.test(androidId) || !UUID_PATTERN.test(iosId)) {
    fail('EAS Android and iOS build IDs must be UUIDs.');
  }
  if (!VERSION_PATTERN.test(runtimeVersion) || !SHA_PATTERN.test(sourceSha)) {
    fail('Binary evidence runtime or source SHA is invalid.');
  }
  return { androidId, iosId, runtimeVersion, sourceSha: sourceSha.toLowerCase() };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) {
      fail(`Invalid or missing value for ${name ?? 'argument'}.`);
    }
    options[name.slice(2)] = value;
  }
  const required = [
    'android-json',
    'app-identifier',
    'evidence',
    'ios-json',
    'output',
    'profile',
    'project-id',
    'runtime',
    'source',
  ];
  const missing = required.filter((name) => !options[name]);
  if (missing.length > 0) fail(`Missing options: ${missing.join(', ')}.`);
  return options;
}

function requireBuildObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} build response must be an object.`);
  }
  return value;
}

function verifyBuild({
  appIdentifier,
  build,
  buildId,
  distribution,
  platform,
  profile,
  projectId,
  runtimeVersion,
  sourceSha,
}) {
  const normalized = requireBuildObject(build, platform);
  const artifactUrl = normalized.artifacts?.applicationArchiveUrl ?? normalized.artifacts?.buildUrl;
  const expectedPlatform = platform.toUpperCase();
  const expectedDistribution = distribution.toUpperCase();

  if (normalized.id !== buildId) fail(`${platform} build ID does not match the approved evidence.`);
  if (normalized.status !== 'FINISHED') fail(`${platform} build is not finished.`);
  if (normalized.platform !== expectedPlatform) fail(`${platform} build platform does not match.`);
  if (normalized.distribution !== expectedDistribution) fail(`${platform} build distribution does not match.`);
  if (normalized.buildProfile !== profile) fail(`${platform} build profile does not match.`);
  if (normalized.gitCommitHash?.toLowerCase() !== sourceSha) fail(`${platform} build source SHA does not match.`);
  if (normalized.appVersion !== runtimeVersion) fail(`${platform} app/runtime version does not match.`);
  if (normalized.appIdentifier !== appIdentifier) fail(`${platform} application identifier does not match.`);
  if (normalized.app?.id !== projectId) fail(`${platform} EAS project does not match.`);
  if (typeof artifactUrl !== 'string' || !artifactUrl.startsWith('https://')) {
    fail(`${platform} build has no provider artifact.`);
  }

  return {
    appBuildVersion: normalized.appBuildVersion ?? null,
    appIdentifier: normalized.appIdentifier,
    appVersion: normalized.appVersion,
    buildProfile: normalized.buildProfile,
    distribution: normalized.distribution,
    gitCommitHash: normalized.gitCommitHash.toLowerCase(),
    id: normalized.id,
    platform: normalized.platform,
    status: normalized.status,
  };
}

export function verifyBuildEvidence(params) {
  const evidence = parseEvidence(params.evidence);
  if (evidence.sourceSha !== params.sourceSha.toLowerCase()) fail('Evidence source SHA does not match.');
  if (evidence.runtimeVersion !== params.runtimeVersion) fail('Evidence runtime does not match.');
  const distribution = params.profile === 'production' ? 'STORE' : 'INTERNAL';
  if (!['preview', 'production'].includes(params.profile)) fail('Build profile is invalid.');

  return {
    builds: [
      verifyBuild({
        ...params,
        build: params.androidBuild,
        buildId: evidence.androidId,
        distribution,
        platform: 'android',
      }),
      verifyBuild({
        ...params,
        build: params.iosBuild,
        buildId: evidence.iosId,
        distribution,
        platform: 'ios',
      }),
    ],
    profile: params.profile,
    projectId: params.projectId,
    runtimeVersion: params.runtimeVersion,
    schemaVersion: 1,
    sourceSha: evidence.sourceSha,
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = verifyBuildEvidence({
    androidBuild: JSON.parse(readFileSync(resolve(options['android-json']), 'utf8')),
    appIdentifier: options['app-identifier'],
    evidence: options.evidence,
    iosBuild: JSON.parse(readFileSync(resolve(options['ios-json']), 'utf8')),
    profile: options.profile,
    projectId: options['project-id'],
    runtimeVersion: options.runtime,
    sourceSha: options.source,
  });
  const outputPath = resolve(options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
