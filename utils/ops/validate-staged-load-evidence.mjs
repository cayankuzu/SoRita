#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/u;
const expectedStages = [
  ['baseline', 25], ['moderate', 250], ['heavy', 1_000], ['target', 10_000],
];
const forbidden = /(?:access[_-]?token|bearer\s+[a-z0-9._-]{12,}|apikey|service[_-]?role|postgres(?:ql)?:\/\/)/iu;
const summaryName = /^k6-read-models-(25|250|1000|10000)-vu-summary\.json$/u;
const maxErrorRate = 0.005;
const maxP95Ms = 600;
const maxP99Ms = 1_200;
const endpointMetrics = [
  'feed_page_complete',
  'explore_page_complete',
  'profile_content_page_complete',
  'notifications_page',
];

function fail(message) { throw new Error(message); }

function finiteMetric(summary, metric, value) {
  const result = summary.metrics?.[metric]?.values?.[value];
  if (!Number.isFinite(result)) fail(`${metric} must include a finite ${value} measurement.`);
  return result;
}

export function validateStagedLoadEvidence({ expectedCandidateSha, manifest, readSummary }) {
  if (!SHA.test(expectedCandidateSha ?? '') || !manifest || manifest.schemaVersion !== 2 || manifest.environment !== 'isolated-staging' || manifest.status !== 'completed' || manifest.candidateSha !== expectedCandidateSha) fail('Evidence must be a schema-v2 completed isolated-staging campaign tied to the expected full candidate SHA.');
  if (!/^[a-z0-9]{20}$/u.test(manifest.target?.projectRef ?? '')) fail('Evidence must identify one canonical isolated staging project.');
  if (!Array.isArray(manifest.stages) || manifest.stages.length !== expectedStages.length) fail('Campaign must contain each approved stage exactly once.');
  for (const [index, [name, vus]] of expectedStages.entries()) {
    const stage = manifest.stages[index];
    if (stage?.stage !== name || stage.targetVUs !== vus || typeof stage.summary !== 'string' || !summaryName.test(stage.summary) || !/^[0-9a-f]{64}$/u.test(stage.sha256 ?? '') || !Number.isInteger(stage.sizeBytes) || stage.sizeBytes < 1 || stage.sizeBytes > 25 * 1024 * 1024) fail(`Invalid ${name} stage evidence.`);
    const rawSummary = readSummary(stage.summary);
    if (!Buffer.isBuffer(rawSummary) || rawSummary.length !== stage.sizeBytes || createHash('sha256').update(rawSummary).digest('hex') !== stage.sha256) fail(`${name} summary checksum or byte count does not match its manifest.`);
    const rawText = rawSummary.toString('utf8');
    if (forbidden.test(rawText)) fail(`${name} summary contains forbidden credential-shaped data.`);
    let summary;
    try { summary = JSON.parse(rawText); } catch { fail(`${name} summary is not valid JSON.`); }
    if (!summary || typeof summary !== 'object') fail(`${name} summary is missing.`);
    if (finiteMetric(summary, 'http_req_failed', 'rate') >= maxErrorRate || finiteMetric(summary, 'read_model_errors', 'rate') >= maxErrorRate) fail(`${name} exceeded the 0.5% error budget.`);
    if (finiteMetric(summary, 'read_model_latency', 'p(95)') >= maxP95Ms || finiteMetric(summary, 'read_model_latency', 'p(99)') >= maxP99Ms) fail(`${name} exceeded the aggregate latency budget.`);
    for (const endpoint of endpointMetrics) {
      if (finiteMetric(summary, `http_req_duration{read_model:${endpoint}}`, 'p(95)') >= maxP95Ms) fail(`${name} exceeded the ${endpoint} p95 budget.`);
    }
  }
  return { candidateSha: manifest.candidateSha, stages: manifest.stages.length, status: 'passed' };
}

function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--dir') fail('Usage: validate-staged-load-evidence.mjs --dir <sanitized-evidence-directory>.');
  const directory = resolve(process.argv[3]);
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', shell: false });
  if (git.status !== 0 || !SHA.test(git.stdout.trim())) fail('Unable to resolve the current candidate SHA.');
  const result = validateStagedLoadEvidence({
    expectedCandidateSha: git.stdout.trim(),
    manifest: JSON.parse(readFileSync(resolve(directory, 'staged-load-campaign.json'), 'utf8')),
    readSummary: (name) => {
      const file = resolve(directory, name);
      if (!existsSync(file)) fail(`Missing stage summary: ${name}.`);
      return readFileSync(file);
    },
  });
  process.stdout.write(`Staged load evidence for ${result.candidateSha}: PASS (${result.stages} stages).\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
