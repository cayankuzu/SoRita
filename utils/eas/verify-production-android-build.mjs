#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{40}$/u;
const VERSION = /^\d+\.\d+\.\d+$/u;

function fail(message) { throw new Error(message); }

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) fail(`Invalid or missing value for ${name ?? 'argument'}.`);
    values[name.slice(2)] = value;
  }
  const missing = ['build-id', 'build-json', 'package-id', 'output', 'project-id', 'runtime', 'source'].filter((name) => !values[name]);
  if (missing.length) fail(`Missing options: ${missing.join(', ')}.`);
  return values;
}

export function verifyProductionAndroidBuild({ build, buildId, packageId, projectId, runtimeVersion, sourceSha }) {
  if (!build || typeof build !== 'object' || Array.isArray(build)) fail('EAS build response must be an object.');
  if (!UUID.test(buildId) || !UUID.test(projectId)) fail('Build and project IDs must be UUIDs.');
  if (!SHA.test(sourceSha) || !VERSION.test(runtimeVersion)) fail('Source SHA or runtime version is invalid.');
  if (build.id !== buildId) fail('EAS build ID does not match the scheduled build.');
  if (build.status !== 'FINISHED') fail('EAS build is not finished.');
  if (build.platform !== 'ANDROID') fail('EAS build platform is not Android.');
  if (build.distribution !== 'STORE') fail('EAS build is not a store build.');
  if (build.buildProfile !== 'production') fail('EAS build profile is not production.');
  if (build.gitCommitHash?.toLowerCase() !== sourceSha) fail('EAS build source SHA does not match.');
  if (build.appVersion !== runtimeVersion) fail('EAS build runtime version does not match.');
  if (build.appIdentifier !== packageId) fail('EAS build application identifier does not match.');
  if (build.app?.id !== projectId) fail('EAS build project does not match.');
  if ((build.updateChannel?.name ?? build.channel) !== 'production') fail('EAS build update channel is not production.');
  if (!/^\d+$/u.test(build.appBuildVersion ?? '')) fail('EAS build number is invalid.');
  const archiveUrl = build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;
  if (typeof archiveUrl !== 'string' || !archiveUrl.startsWith('https://')) fail('EAS build has no provider artifact.');
  return {
    appBuildVersion: build.appBuildVersion,
    appIdentifier: build.appIdentifier,
    appVersion: build.appVersion,
    buildProfile: build.buildProfile,
    distribution: build.distribution,
    gitCommitHash: build.gitCommitHash.toLowerCase(),
    id: build.id,
    platform: build.platform,
    projectId: build.app.id,
    schemaVersion: 1,
    status: build.status,
    updateChannel: 'production',
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const verified = verifyProductionAndroidBuild({
    build: JSON.parse(readFileSync(resolve(options['build-json']), 'utf8')),
    buildId: options['build-id'], packageId: options['package-id'], projectId: options['project-id'],
    runtimeVersion: options.runtime, sourceSha: options.source,
  });
  const output = resolve(options.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(verified, null, 2)}\n`, { flag: 'wx' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
