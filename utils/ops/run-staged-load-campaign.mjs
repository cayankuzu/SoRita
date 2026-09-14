#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const stages = [25, 250, 1_000, 10_000];
const confirmation = 'STAGING_ONLY_APPROVED_CAMPAIGN';

function fail(message) { throw new Error(message); }

function stageName(vus) { return ({ 25: 'baseline', 250: 'moderate', 1000: 'heavy', 10000: 'target' })[vus]; }

function gitOutput(args) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) fail(`Unable to verify immutable source with git ${args.join(' ')}.`);
  return result.stdout.trim();
}

function main() {
  if (process.env.SORITA_LOAD_CAMPAIGN_CONFIRM !== confirmation) fail(`Campaign requires SORITA_LOAD_CAMPAIGN_CONFIRM=${confirmation}.`);
  const evidenceDir = process.env.SORITA_LOAD_EVIDENCE_DIR?.trim();
  const candidateSha = process.env.SORITA_LOAD_CANDIDATE_SHA?.trim();
  if (!evidenceDir || !candidateSha || !/^[0-9a-f]{40}$/u.test(candidateSha)) fail('SORITA_LOAD_EVIDENCE_DIR and a canonical SORITA_LOAD_CANDIDATE_SHA are required.');
  if (gitOutput(['rev-parse', 'HEAD']) !== candidateSha) fail('SORITA_LOAD_CANDIDATE_SHA must equal the checked-out HEAD exactly.');
  if (gitOutput(['status', '--porcelain=v1', '--untracked-files=all'])) fail('The staged campaign requires a clean immutable checkout.');

  const stagingProjectRef = process.env.SORITA_LOAD_STAGING_PROJECT_REF?.trim();
  const productionProjectRef = process.env.SORITA_LOAD_PRODUCTION_PROJECT_REF?.trim();
  if (!/^[a-z0-9]{20}$/u.test(stagingProjectRef ?? '') || !/^[a-z0-9]{20}$/u.test(productionProjectRef ?? '') || stagingProjectRef === productionProjectRef) {
    fail('Distinct canonical staging and production project refs are required.');
  }
  const outputDirectory = resolve(evidenceDir);
  if (existsSync(outputDirectory)) {
    const metadata = lstatSync(outputDirectory);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail('SORITA_LOAD_EVIDENCE_DIR must be a real directory, not a link.');
    if (readdirSync(outputDirectory).length > 0) fail('SORITA_LOAD_EVIDENCE_DIR must be empty.');
  } else {
    mkdirSync(outputDirectory, { recursive: true, mode: 0o777 });
  }
  chmodSync(outputDirectory, 0o777);
  const completed = [];
  for (const vus of stages) {
    const result = spawnSync(process.execPath, ['infra/docker/scripts/run-staged-load-profile.mjs'], {
      cwd: repositoryRoot,
      env: { ...process.env, SORITA_STAGED_LOAD_CONFIRM: 'STAGING_ONLY_NO_PRODUCTION', SORITA_LOAD_TARGET_VUS: String(vus), SORITA_LOAD_EVIDENCE_DIR: outputDirectory },
      shell: false,
      stdio: 'inherit',
    });
    if (result.status !== 0) fail(`Stage ${stageName(vus)} (${vus} VUs) failed; the campaign stopped before the next stage.`);
    const summary = `k6-read-models-${vus}-vu-summary.json`;
    const summaryBytes = readFileSync(resolve(outputDirectory, summary));
    if (summaryBytes.length === 0 || summaryBytes.length > 25 * 1024 * 1024) fail(`Stage ${stageName(vus)} emitted an invalid summary size.`);
    completed.push({
      sha256: createHash('sha256').update(summaryBytes).digest('hex'),
      sizeBytes: summaryBytes.length,
      stage: stageName(vus),
      targetVUs: vus,
      summary,
    });
  }
  const manifest = {
    candidateSha,
    completedAt: new Date().toISOString(),
    environment: 'isolated-staging',
    schemaVersion: 2,
    stages: completed,
    status: 'completed',
    target: { projectRef: stagingProjectRef },
  };
  writeFileSync(resolve(outputDirectory, 'staged-load-campaign.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write('Staged load campaign completed; validate the sanitized evidence before accepting capacity conclusions.\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
