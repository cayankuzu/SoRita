#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_VERSION = 1;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CHECK_STATES = new Set(['pass', 'fail', 'unverified']);
export const REQUIRED_RELEASE_CHECKS = Object.freeze([
  'quality',
  'database-local',
  'feature-surface',
  'evidence-tool',
  'sast-secret-scan',
  'cloudflare-preview',
  'signed-android-ios',
  'physical-device-matrix',
  'provider-dashboards',
  'staging-restore',
  'store-internal-tracks',
  'ota-preview-rollback',
  'backup-pitr',
  'observability-alerts',
  'security-review',
]);
const REQUIRED_RELEASE_CHECK_SET = new Set(REQUIRED_RELEASE_CHECKS);

function fail(message) {
  throw new Error(message);
}

function runGit(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function toRepositoryIdentity(remoteUrl) {
  if (!remoteUrl) return null;
  const normalized = remoteUrl
    .replace(/^git@github\.com:/u, 'https://github.com/')
    .replace(/\.git$/u, '');
  return normalized;
}

function hashFile(filePath) {
  const body = readFileSync(filePath);
  return createHash('sha256').update(body).digest('hex');
}

function parseNamedValue(value, optionName) {
  const separator = value.indexOf('=');
  if (separator <= 0 || separator === value.length - 1) {
    fail(`${optionName} must use name=value syntax`);
  }
  return [value.slice(0, separator), value.slice(separator + 1)];
}

export function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!['create', 'verify'].includes(command)) {
    fail('Usage: manifest.mjs <create|verify> --manifest <path> [options]');
  }

  const parsed = {
    command,
    artifacts: [],
    results: [],
    manifest: null,
    channel: process.env.RELEASE_CHANNEL ?? null,
    environment: process.env.RELEASE_ENVIRONMENT ?? null,
    runtimeVersion: process.env.RELEASE_RUNTIME_VERSION ?? null,
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const option = tokens[index];
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) fail(`Missing value for ${option}`);
    index += 1;

    if (option === '--manifest') parsed.manifest = value;
    else if (option === '--artifact') parsed.artifacts.push(value);
    else if (option === '--result') parsed.results.push(parseNamedValue(value, option));
    else if (option === '--channel') parsed.channel = value;
    else if (option === '--environment') parsed.environment = value;
    else if (option === '--runtime-version') parsed.runtimeVersion = value;
    else fail(`Unknown option: ${option}`);
  }

  if (!parsed.manifest) fail('--manifest is required');
  if (command === 'create' && parsed.artifacts.length === 0) {
    fail('At least one --artifact is required');
  }
  if (command === 'create' && parsed.results.length === 0) {
    fail('At least one --result is required');
  }
  return parsed;
}

function assertCleanRepository(cwd) {
  const status = runGit(cwd, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status) {
    fail('Release evidence requires a clean Git working tree');
  }
}

function repositoryMetadata(cwd) {
  const commitSha = runGit(cwd, ['rev-parse', 'HEAD']);
  if (!SHA_PATTERN.test(commitSha)) fail('Git HEAD is not a full immutable commit SHA');

  let remote = null;
  try {
    remote = runGit(cwd, ['remote', 'get-url', 'origin']);
  } catch {
    // A local verification repository may intentionally have no remote.
  }

  let ref = null;
  try {
    ref = runGit(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  } catch {
    // CI commonly checks out an immutable SHA in detached-HEAD mode.
  }

  return {
    commitSha,
    repository: toRepositoryIdentity(remote),
    ref,
  };
}

function normalizeArtifact(cwd, artifactPath) {
  const absolutePath = resolve(cwd, artifactPath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    fail(`Evidence artifact does not exist or is not a file: ${artifactPath}`);
  }
  const workspacePath = relative(cwd, absolutePath).replaceAll('\\', '/');
  if (workspacePath.startsWith('../') || workspacePath === '..') {
    fail(`Evidence artifact must be inside the repository workspace: ${artifactPath}`);
  }
  return {
    path: workspacePath,
    bytes: statSync(absolutePath).size,
    sha256: hashFile(absolutePath),
  };
}

function normalizeResults(results) {
  const normalized = {};
  for (const [name, state] of results) {
    if (!/^[a-z0-9][a-z0-9._-]*$/u.test(name)) fail(`Invalid result name: ${name}`);
    if (!CHECK_STATES.has(state)) fail(`Invalid result state for ${name}: ${state}`);
    if (Object.hasOwn(normalized, name)) fail(`Duplicate result name: ${name}`);
    normalized[name] = state;
  }

  const missingChecks = REQUIRED_RELEASE_CHECKS.filter((name) => !Object.hasOwn(normalized, name));
  if (missingChecks.length > 0) {
    fail(`Missing required release checks: ${missingChecks.join(', ')}`);
  }

  const unknownChecks = Object.keys(normalized).filter((name) => !REQUIRED_RELEASE_CHECK_SET.has(name));
  if (unknownChecks.length > 0) {
    fail(`Unknown release checks for schema v${SCHEMA_VERSION}: ${unknownChecks.join(', ')}`);
  }

  return normalized;
}

export function createManifest({ cwd, options, now = new Date() }) {
  assertCleanRepository(cwd);
  const repository = repositoryMetadata(cwd);
  const artifacts = options.artifacts.map((artifact) => normalizeArtifact(cwd, artifact));
  const uniquePaths = new Set(artifacts.map(({ path }) => path));
  if (uniquePaths.size !== artifacts.length) fail('Duplicate evidence artifact path');

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    repository: repository.repository,
    commitSha: repository.commitSha,
    ref: repository.ref,
    treeState: 'clean',
    generatedAt: now.toISOString(),
    release: {
      environment: options.environment,
      channel: options.channel,
      runtimeVersion: options.runtimeVersion,
    },
    checks: normalizeResults(options.results),
    artifacts,
  };

  const manifestPath = resolve(cwd, options.manifest);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return manifest;
}

function assertManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('Evidence manifest must be an object');
  }
  if (manifest?.schemaVersion !== SCHEMA_VERSION) fail('Unsupported evidence manifest schema');
  if (!SHA_PATTERN.test(manifest.commitSha ?? '')) fail('Manifest commitSha is invalid');
  if (manifest.treeState !== 'clean') fail('Manifest does not attest a clean tree');
  if (!manifest.checks || typeof manifest.checks !== 'object' || Array.isArray(manifest.checks)) {
    fail('Manifest checks must be an object');
  }
  normalizeResults(Object.entries(manifest.checks));
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    fail('Manifest must contain at least one artifact');
  }
}

function resolveManifestArtifact(cwd, artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    fail('Manifest artifact must be an object');
  }

  const keys = Object.keys(artifact).sort();
  if (keys.join(',') !== 'bytes,path,sha256') {
    fail('Manifest artifact has unexpected fields');
  }
  if (typeof artifact.path !== 'string' || !artifact.path) {
    fail('Manifest artifact path is invalid');
  }
  if (!Number.isInteger(artifact.bytes) || artifact.bytes < 0) {
    fail(`Manifest artifact byte count is invalid: ${artifact.path}`);
  }
  if (typeof artifact.sha256 !== 'string' || !SHA256_PATTERN.test(artifact.sha256)) {
    fail(`Manifest artifact checksum is invalid: ${artifact.path}`);
  }

  const absoluteArtifactPath = resolve(cwd, artifact.path);
  const workspacePath = relative(cwd, absoluteArtifactPath).replaceAll('\\', '/');
  if (
    workspacePath.startsWith('../') ||
    workspacePath === '..' ||
    workspacePath !== artifact.path.replaceAll('\\', '/')
  ) {
    fail(`Evidence artifact must use a normalized repository-relative path: ${artifact.path}`);
  }

  return absoluteArtifactPath;
}

export function verifyManifest({ cwd, manifestPath }) {
  assertCleanRepository(cwd);
  const absoluteManifestPath = resolve(cwd, manifestPath);
  const manifest = JSON.parse(readFileSync(absoluteManifestPath, 'utf8'));
  assertManifestShape(manifest);

  const currentSha = runGit(cwd, ['rev-parse', 'HEAD']);
  if (manifest.commitSha !== currentSha) {
    fail(`Manifest SHA ${manifest.commitSha} does not match HEAD ${currentSha}`);
  }
  if (Object.values(manifest.checks ?? {}).some((state) => state !== 'pass')) {
    fail('Manifest contains failed or unverified checks');
  }

  const seen = new Set();
  for (const artifact of manifest.artifacts) {
    if (seen.has(artifact.path)) fail(`Duplicate artifact path: ${artifact.path}`);
    seen.add(artifact.path);
    const absoluteArtifactPath = resolveManifestArtifact(cwd, artifact);
    if (!existsSync(absoluteArtifactPath) || !statSync(absoluteArtifactPath).isFile()) {
      fail(`Evidence artifact is missing: ${artifact.path}`);
    }
    if (statSync(absoluteArtifactPath).size !== artifact.bytes) {
      fail(`Evidence artifact size changed: ${artifact.path}`);
    }
    if (hashFile(absoluteArtifactPath) !== artifact.sha256) {
      fail(`Evidence artifact checksum changed: ${artifact.path}`);
    }
  }
  return manifest;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const cwd = process.cwd();
  if (options.command === 'create') {
    const manifest = createManifest({ cwd, options });
    process.stdout.write(`${manifest.commitSha}\n`);
  } else {
    const manifest = verifyManifest({ cwd, manifestPath: options.manifest });
    process.stdout.write(`${manifest.commitSha}\n`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`release-evidence: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
