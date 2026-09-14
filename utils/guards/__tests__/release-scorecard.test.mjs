import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  BASELINE_CATEGORY_CONTRACT,
  BASELINE_SCORING_RULE,
  BASELINE_VERDICT_STATEMENT,
  CATEGORY_RUNTIME_CHECKS,
  EXPECTED_CATEGORY_COUNT,
  EXPECTED_TARGET_SCORE,
  SCORECARD_REPOSITORY,
  SCORECARD_SCHEMA_VERSION,
  validateScorecard,
} from '../check-release-scorecard.mjs';
import {
  REQUIRED_RUNTIME_CHECKS,
} from '../../release-evidence/runtime-evidence.mjs';

const SCORECARD_PATH = join(
  process.cwd(),
  'quality',
  'release-scorecard.json',
);
const GUARD_PATH = join(
  process.cwd(),
  'utils',
  'guards',
  'check-release-scorecard.mjs',
);

function baseline() {
  return JSON.parse(readFileSync(SCORECARD_PATH, 'utf8'));
}

test('the checked-in scorecard is a valid NO-GO baseline policy', () => {
  assert.deepEqual(validateScorecard(baseline()), []);
});

test('the real CLI validates the baseline at the actual git HEAD', () => {
  const head = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
  const result = spawnSync(process.execPath, [GUARD_PATH], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(head, 'u'));
  assert.match(result.stdout, /final GO requires a verified release-evidence workflow artifact/u);
});

test('the baseline schema and immutable top-level policy are exact', () => {
  const scorecard = baseline();
  assert.equal(scorecard.schemaVersion, SCORECARD_SCHEMA_VERSION);
  assert.equal(scorecard.repository, SCORECARD_REPOSITORY);
  assert.equal(scorecard.targetScore, EXPECTED_TARGET_SCORE);
  assert.equal(scorecard.scoringRule, BASELINE_SCORING_RULE);
  assert.equal(scorecard.verdict, 'NO-GO');
  assert.equal(scorecard.verdictStatement, BASELINE_VERDICT_STATEMENT);
  assert.equal(Object.hasOwn(scorecard, 'commitSha'), false);
});

test('all 35 category identities, scores and evidence levels are pinned', () => {
  const scorecard = baseline();
  assert.equal(scorecard.categories.length, EXPECTED_CATEGORY_COUNT);
  assert.deepEqual(
    scorecard.categories.map(({ id, name, score, evidenceLevel }) => ({
      id,
      name,
      score,
      evidenceLevel,
    })),
    BASELINE_CATEGORY_CONTRACT,
  );
});

test('every category has a frozen canonical runtime-check contract', () => {
  assert.equal(Object.isFrozen(CATEGORY_RUNTIME_CHECKS), true);
  assert.deepEqual(
    Object.keys(CATEGORY_RUNTIME_CHECKS).map(Number),
    Array.from({ length: EXPECTED_CATEGORY_COUNT }, (_, index) => index + 1),
  );
  const knownChecks = new Set(REQUIRED_RUNTIME_CHECKS);
  for (const checks of Object.values(CATEGORY_RUNTIME_CHECKS)) {
    assert.equal(Object.isFrozen(checks), true);
    assert.ok(checks.length > 0);
    assert.equal(new Set(checks).size, checks.length);
    assert.ok(checks.every((check) => knownChecks.has(check)));
  }
  assert.deepEqual(CATEGORY_RUNTIME_CHECKS[1], ['physical-device-matrix']);
  assert.deepEqual(CATEGORY_RUNTIME_CHECKS[4], [
    'security-review',
    'staging-restore',
    'provider-dashboards',
  ]);
  assert.deepEqual(CATEGORY_RUNTIME_CHECKS[27], REQUIRED_RUNTIME_CHECKS);
});

test('a checked-in category cannot claim target or runtime verification', () => {
  const targetClaim = baseline();
  targetClaim.categories[0].score = EXPECTED_TARGET_SCORE;
  targetClaim.categories[0].evidenceLevel = 'RUNTIME_VERIFIED';
  const violations = validateScorecard(targetClaim);

  assert.ok(violations.some((entry) => entry.includes('cannot claim')));
  assert.ok(violations.some((entry) => entry.includes('cannot be RUNTIME_VERIFIED')));
});

test('arbitrary runtime receipt paths are rejected instead of being trusted', () => {
  const scorecard = baseline();
  scorecard.categories[0].runtimeEvidence = [
    'artifacts/runtime-evidence/evidence/physical-device-matrix.json',
  ];
  const violations = validateScorecard(scorecard);

  assert.ok(
    violations.some((entry) =>
      entry.includes('trusted runtime evidence belongs in the release workflow artifact'),
    ),
  );
});

test('GO and legacy CONDITIONAL_GO cannot be written into the baseline', () => {
  for (const verdict of ['GO', 'CONDITIONAL_GO']) {
    const scorecard = baseline();
    scorecard.verdict = verdict;
    assert.ok(
      validateScorecard(scorecard).some((entry) =>
        entry.includes('baseline verdict must remain NO-GO'),
      ),
    );
  }
});

test('unsupported fields and top-level policy drift fail closed', () => {
  const withCommitSha = baseline();
  withCommitSha.commitSha = 'a'.repeat(40);
  assert.ok(
    validateScorecard(withCommitSha).some((entry) =>
      entry.includes('unsupported property commitSha'),
    ),
  );

  const badSchema = baseline();
  badSchema.schemaVersion = 1;
  assert.ok(validateScorecard(badSchema).some((entry) => entry.includes('schemaVersion')));

  const badRepository = baseline();
  badRepository.repository = 'https://example.invalid/repository';
  assert.ok(validateScorecard(badRepository).some((entry) => entry.includes('repository must be')));

  const badTarget = baseline();
  badTarget.targetScore = 9.7;
  assert.ok(validateScorecard(badTarget).some((entry) => entry.includes('exactly 9.8')));

  const extra = baseline();
  extra.unreviewed = true;
  assert.ok(
    validateScorecard(extra).some((entry) =>
      entry.includes('unsupported property unreviewed'),
    ),
  );
});

test('category identity, ordering, score and level drift fail closed', () => {
  const badId = baseline();
  badId.categories[0].id = 2;
  assert.ok(validateScorecard(badId).some((entry) => entry.includes('id/order')));

  const badName = baseline();
  badName.categories[1].name = 'Renamed';
  assert.ok(validateScorecard(badName).some((entry) => entry.includes('canonical name')));

  const badScore = baseline();
  badScore.categories[2].score = 9.79;
  assert.ok(validateScorecard(badScore).some((entry) => entry.includes('baseline score')));

  const badLevel = baseline();
  badLevel.categories[3].evidenceLevel = 'MANUAL';
  assert.ok(validateScorecard(badLevel).some((entry) => entry.includes('baseline evidenceLevel')));

  const missing = baseline();
  missing.categories.pop();
  assert.ok(validateScorecard(missing).some((entry) => entry.includes('exactly 35')));
});

test('evidence arrays, gaps and assessment date are strictly validated', () => {
  const duplicateEvidence = baseline();
  duplicateEvidence.categories[0].automatedEvidence.push(
    duplicateEvidence.categories[0].automatedEvidence[0],
  );
  assert.ok(validateScorecard(duplicateEvidence).some((entry) => entry.includes('repeats')));

  const invalidRuntimeArray = baseline();
  invalidRuntimeArray.categories[0].runtimeEvidence = 'manual';
  assert.ok(validateScorecard(invalidRuntimeArray).some((entry) => entry.includes('must be an array')));

  const emptyGap = baseline();
  emptyGap.categories[0].gap = '';
  assert.ok(validateScorecard(emptyGap).some((entry) => entry.includes('remaining gap')));

  const invalidDate = baseline();
  invalidDate.generatedAt = '2026-02-30';
  assert.ok(validateScorecard(invalidDate).some((entry) => entry.includes('canonical YYYY-MM-DD')));
});

test('non-object scorecards fail closed', () => {
  assert.deepEqual(validateScorecard(null), ['scorecard must be an object']);
  assert.deepEqual(validateScorecard([]), ['scorecard must be an object']);
});
