import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { validateStagedLoadEvidence } from './validate-staged-load-evidence.mjs';

const summary = { metrics: {
  http_req_failed: { values: { rate: 0 } },
  read_model_errors: { values: { rate: 0 } },
  read_model_latency: { values: { 'p(95)': 100, 'p(99)': 200 } },
  'http_req_duration{read_model:feed_page_complete}': { values: { 'p(95)': 100 } },
  'http_req_duration{read_model:explore_page_complete}': { values: { 'p(95)': 100 } },
  'http_req_duration{read_model:profile_content_page_complete}': { values: { 'p(95)': 100 } },
  'http_req_duration{read_model:notifications_page}': { values: { 'p(95)': 100 } },
} };
const bytes = Buffer.from(JSON.stringify(summary));
const stages = [[ 'baseline', 25 ], [ 'moderate', 250 ], [ 'heavy', 1000 ], [ 'target', 10000 ]].map(([stage, targetVUs]) => ({ sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.length, stage, targetVUs, summary: `k6-read-models-${targetVUs}-vu-summary.json` }));
const candidateSha = 'a'.repeat(40);
const manifest = { candidateSha, environment: 'isolated-staging', schemaVersion: 2, stages, status: 'completed', target: { projectRef: 'b'.repeat(20) } };

test('staged load evidence requires all non-production stages and usable k6 summaries', () => {
  assert.equal(validateStagedLoadEvidence({ expectedCandidateSha: candidateSha, manifest, readSummary: () => bytes }).status, 'passed');
  assert.throws(() => validateStagedLoadEvidence({ expectedCandidateSha: candidateSha, manifest: { ...manifest, environment: 'production' }, readSummary: () => bytes }));
  assert.throws(() => validateStagedLoadEvidence({ expectedCandidateSha: 'c'.repeat(40), manifest, readSummary: () => bytes }));
  assert.throws(() => validateStagedLoadEvidence({ expectedCandidateSha: candidateSha, manifest: { ...manifest, stages: [{ ...stages[0], sha256: 'd'.repeat(64) }, ...stages.slice(1)] }, readSummary: () => bytes }));
});

test('staged load evidence rejects breached error and latency thresholds', () => {
  const failing = Buffer.from(JSON.stringify({ ...summary, metrics: { ...summary.metrics, http_req_failed: { values: { rate: 0.005 } } } }));
  const failingStages = stages.map((stage) => ({ ...stage, sha256: createHash('sha256').update(failing).digest('hex'), sizeBytes: failing.length }));
  assert.throws(() => validateStagedLoadEvidence({ expectedCandidateSha: candidateSha, manifest: { ...manifest, stages: failingStages }, readSummary: () => failing }), /error budget/u);
});
