#!/usr/bin/env node

// The checked-in scorecard is a conservative, reviewable baseline policy.
// It is not a release attestation: a tracked file cannot contain the SHA of
// the commit that contains itself. Final GO evidence is produced and verified
// as a checksum-bound workflow artifact by release-evidence.yml.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REQUIRED_RUNTIME_CHECKS } from '../release-evidence/runtime-evidence.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export const EXPECTED_CATEGORY_COUNT = 35;
export const EXPECTED_TARGET_SCORE = 9.8;
export const SCORECARD_SCHEMA_VERSION = 2;
export const SCORECARD_REPOSITORY = 'https://github.com/cayankuzu/SoRita';
export const BASELINE_SCORING_RULE =
  'The checked-in scorecard is a NO-GO baseline and cannot assert runtime verification. Final GO exists only in a checksum-bound release-evidence workflow artifact for the exact candidate SHA.';
export const BASELINE_VERDICT_STATEMENT =
  'REPOSITORY BASELINE ONLY. RELEASE NO-GO UNTIL THE CHECKSUM-BOUND SAME-SHA WORKFLOW ATTESTATION VERIFIES EVERY REQUIRED RUNTIME AND PROVIDER CHECK.';
export const EVIDENCE_LEVELS = Object.freeze([
  'NONE',
  'STATIC',
  'AUTOMATED',
  'MANUAL',
  'RUNTIME_VERIFIED',
]);

export const BASELINE_CATEGORY_CONTRACT = Object.freeze(
  [
    [1, 'UI/UX and visual consistency', 9.3, 'AUTOMATED'],
    [2, 'Multi-device and screen', 9.1, 'AUTOMATED'],
    [3, 'Performance and perceived speed', 8.9, 'AUTOMATED'],
    [4, 'Security and privacy', 9.5, 'AUTOMATED'],
    [5, 'Architecture and code quality', 9.6, 'AUTOMATED'],
    [6, 'DRY', 9.5, 'AUTOMATED'],
    [7, 'Hardcode and config', 9.5, 'AUTOMATED'],
    [8, 'State management', 9.4, 'AUTOMATED'],
    [9, 'Network and API', 9.4, 'AUTOMATED'],
    [10, 'Accessibility', 9, 'AUTOMATED'],
    [11, 'Scale and infrastructure', 8.6, 'AUTOMATED'],
    [12, 'Error handling and resilience', 9.1, 'AUTOMATED'],
    [13, 'Test coverage', 9.5, 'AUTOMATED'],
    [14, 'Localization', 9.6, 'AUTOMATED'],
    [15, 'Offline and persistence', 9.1, 'AUTOMATED'],
    [16, 'Push and deep link', 8.7, 'AUTOMATED'],
    [17, 'Analytics and observability', 8.7, 'STATIC'],
    [18, 'CI/CD', 9.4, 'AUTOMATED'],
    [19, 'Documentation', 9.4, 'AUTOMATED'],
    [20, 'Domain logic', 9.4, 'AUTOMATED'],
    [21, 'Dependencies', 9.4, 'AUTOMATED'],
    [22, 'Battery and resource use', 8.4, 'STATIC'],
    [23, 'Platform compatibility', 8.8, 'AUTOMATED'],
    [24, 'Store readiness', 8.2, 'STATIC'],
    [25, 'Operations maturity', 9, 'AUTOMATED'],
    [26, 'Readability and simplicity', 9.4, 'AUTOMATED'],
    [27, 'Overall maturity', 8.8, 'AUTOMATED'],
    [28, 'Code architecture', 9.5, 'AUTOMATED'],
    [29, 'Code quality', 9.5, 'AUTOMATED'],
    [30, 'KISS', 9.5, 'AUTOMATED'],
    [31, 'Code hardcode', 9.4, 'AUTOMATED'],
    [32, 'Reuse', 9.4, 'AUTOMATED'],
    [33, 'Code performance', 8.9, 'AUTOMATED'],
    [34, 'Testability', 9.5, 'AUTOMATED'],
    [35, 'Extensibility', 9.3, 'AUTOMATED'],
  ].map(([id, name, score, evidenceLevel]) =>
    Object.freeze({ id, name, score, evidenceLevel }),
  ),
);

export const CATEGORY_RUNTIME_CHECKS = Object.freeze({
  1: Object.freeze(['physical-device-matrix']),
  2: Object.freeze(['physical-device-matrix']),
  3: Object.freeze(['physical-device-matrix']),
  4: Object.freeze(['security-review', 'staging-restore', 'provider-dashboards']),
  5: Object.freeze(['security-review']),
  6: Object.freeze(['security-review']),
  7: Object.freeze(['security-review', 'provider-dashboards']),
  8: Object.freeze(['physical-device-matrix', 'staging-restore']),
  9: Object.freeze(['cloudflare-preview', 'security-review']),
  10: Object.freeze(['physical-device-matrix']),
  11: Object.freeze(['cloudflare-preview', 'staging-restore', 'provider-dashboards']),
  12: Object.freeze(['cloudflare-preview', 'physical-device-matrix']),
  13: Object.freeze(['security-review', 'staging-restore', 'physical-device-matrix']),
  14: Object.freeze(['physical-device-matrix']),
  15: Object.freeze(['physical-device-matrix', 'staging-restore']),
  16: Object.freeze(['physical-device-matrix', 'provider-dashboards']),
  17: Object.freeze(['observability-alerts']),
  18: Object.freeze(['security-review']),
  19: Object.freeze(['security-review']),
  20: Object.freeze(['staging-restore']),
  21: Object.freeze(['security-review']),
  22: Object.freeze(['physical-device-matrix']),
  23: Object.freeze(['signed-android-ios']),
  24: Object.freeze(['store-internal-tracks']),
  25: Object.freeze([
    'provider-dashboards',
    'backup-pitr',
    'observability-alerts',
    'ota-preview-rollback',
  ]),
  26: Object.freeze(['security-review']),
  27: Object.freeze([...REQUIRED_RUNTIME_CHECKS]),
  28: Object.freeze(['security-review']),
  29: Object.freeze(['security-review']),
  30: Object.freeze(['security-review']),
  31: Object.freeze(['security-review']),
  32: Object.freeze(['security-review']),
  33: Object.freeze(['physical-device-matrix']),
  34: Object.freeze(['security-review']),
  35: Object.freeze(['signed-android-ios', 'ota-preview-rollback']),
});

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'repository',
  'generatedAt',
  'targetScore',
  'scoringRule',
  'verdict',
  'verdictStatement',
  'categories',
]);
const CATEGORY_KEYS = Object.freeze([
  'id',
  'name',
  'score',
  'evidenceLevel',
  'automatedEvidence',
  'runtimeEvidence',
  'gap',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateExactKeys(value, expectedKeys, label, push) {
  const expected = new Set(expectedKeys);
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      push(label + ' is missing required property ' + key);
    }
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      push(label + ' contains unsupported property ' + key);
    }
  }
}

function validateStringArray(value, label, push, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    push(label + ' must be an array');
    return;
  }
  if (!allowEmpty && value.length === 0) {
    push(label + ' must not be empty');
  }
  const seen = new Set();
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '' || entry !== entry.trim()) {
      push(label + '[' + index + '] must be a non-empty trimmed string');
      return;
    }
    if (seen.has(entry)) {
      push(label + ' repeats ' + entry);
    }
    seen.add(entry);
  });
}

function isCanonicalDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateRuntimeContract(push) {
  const knownChecks = new Set(REQUIRED_RUNTIME_CHECKS);
  const ids = Object.keys(CATEGORY_RUNTIME_CHECKS).map(Number);
  const expectedIds = Array.from(
    { length: EXPECTED_CATEGORY_COUNT },
    (_, index) => index + 1,
  );
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    push('category runtime contracts must cover the exact ids 1 through 35');
  }
  for (const [id, checks] of Object.entries(CATEGORY_RUNTIME_CHECKS)) {
    if (
      checks.length === 0
      || new Set(checks).size !== checks.length
      || checks.some((check) => !knownChecks.has(check))
    ) {
      push('category ' + id + ' has an invalid runtime check contract');
    }
  }
}

export function validateScorecard(scorecard) {
  const violations = [];
  const push = (message) => violations.push(message);

  if (!isRecord(scorecard)) {
    return ['scorecard must be an object'];
  }

  validateExactKeys(scorecard, TOP_LEVEL_KEYS, 'scorecard', push);
  validateRuntimeContract(push);

  if (scorecard.schemaVersion !== SCORECARD_SCHEMA_VERSION) {
    push('schemaVersion must be ' + SCORECARD_SCHEMA_VERSION);
  }
  if (scorecard.repository !== SCORECARD_REPOSITORY) {
    push('repository must be ' + SCORECARD_REPOSITORY);
  }
  if (!isCanonicalDateOnly(scorecard.generatedAt)) {
    push('generatedAt must be a canonical YYYY-MM-DD date');
  }
  if (scorecard.targetScore !== EXPECTED_TARGET_SCORE) {
    push('targetScore must remain exactly ' + EXPECTED_TARGET_SCORE);
  }
  if (scorecard.scoringRule !== BASELINE_SCORING_RULE) {
    push('scoringRule must describe the workflow-attested release boundary');
  }
  if (scorecard.verdict !== 'NO-GO') {
    push('the checked-in baseline verdict must remain NO-GO');
  }
  if (scorecard.verdictStatement !== BASELINE_VERDICT_STATEMENT) {
    push('verdictStatement must preserve the workflow-attestation requirement');
  }

  if (!Array.isArray(scorecard.categories)) {
    push('categories must be an array');
    return violations;
  }
  if (scorecard.categories.length !== EXPECTED_CATEGORY_COUNT) {
    push(
      'categories must contain exactly ' + EXPECTED_CATEGORY_COUNT
      + ' entries, found ' + scorecard.categories.length,
    );
  }

  const seenIds = new Set();
  const seenNames = new Set();
  scorecard.categories.forEach((category, index) => {
    const expected = BASELINE_CATEGORY_CONTRACT[index];
    const label = 'category ' + (category?.id ?? index + 1);
    if (!isRecord(category)) {
      push(label + ' must be an object');
      return;
    }
    validateExactKeys(category, CATEGORY_KEYS, label, push);

    if (!expected) {
      push(label + ' has no baseline contract');
      return;
    }
    if (category.id !== expected.id) {
      push(label + ' id/order must remain ' + expected.id);
    }
    if (seenIds.has(category.id)) {
      push(label + ' is duplicated');
    }
    seenIds.add(category.id);

    if (category.name !== expected.name) {
      push(label + ' canonical name must remain ' + expected.name);
    }
    if (seenNames.has(category.name)) {
      push(label + ' reuses another category name');
    }
    seenNames.add(category.name);

    if (category.score !== expected.score) {
      push(label + ' baseline score must remain ' + expected.score);
    }
    if (typeof category.score !== 'number' || category.score >= EXPECTED_TARGET_SCORE) {
      push(label + ' cannot claim the runtime-verified target in the checked-in baseline');
    }
    if (!EVIDENCE_LEVELS.includes(category.evidenceLevel)) {
      push(label + ' evidenceLevel is invalid');
    }
    if (category.evidenceLevel !== expected.evidenceLevel) {
      push(label + ' baseline evidenceLevel must remain ' + expected.evidenceLevel);
    }
    if (category.evidenceLevel === 'RUNTIME_VERIFIED') {
      push(label + ' cannot be RUNTIME_VERIFIED in the checked-in baseline');
    }

    validateStringArray(category.automatedEvidence, label + '.automatedEvidence', push);
    validateStringArray(
      category.runtimeEvidence,
      label + '.runtimeEvidence',
      push,
      { allowEmpty: true },
    );
    if (Array.isArray(category.runtimeEvidence) && category.runtimeEvidence.length > 0) {
      push(
        label
        + ' runtimeEvidence must remain empty; trusted runtime evidence belongs in the release workflow artifact',
      );
    }
    if (typeof category.gap !== 'string' || category.gap.trim() === '') {
      push(label + ' must state its remaining gap');
    }
  });

  return violations;
}

function currentGitHead() {
  const head = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(head)) {
    throw new Error('git rev-parse HEAD did not return a full commit SHA');
  }
  return head;
}

function main() {
  const scorecardPath = path.join(repositoryRoot, 'quality', 'release-scorecard.json');
  let scorecard;
  let head;
  try {
    scorecard = JSON.parse(readFileSync(scorecardPath, 'utf8'));
    head = currentGitHead();
  } catch (error) {
    console.error('[release-scorecard] Unreadable baseline: ' + error.message);
    process.exit(1);
  }

  const violations = validateScorecard(scorecard);
  if (violations.length > 0) {
    console.error('[release-scorecard] Failed:\n- ' + violations.join('\n- '));
    process.exit(1);
  }

  console.log(
    '[release-scorecard] OK ('
      + scorecard.categories.length
      + ' category working-tree NO-GO baseline policy validated; HEAD '
      + head
      + ' is context only, NOT SHA-BOUND; final GO requires a verified release-evidence workflow artifact)',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
