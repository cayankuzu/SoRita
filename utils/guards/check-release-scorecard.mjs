#!/usr/bin/env node

// Enforces the release scoring honesty rule.
//
// A category may only claim a score at or above the target when it carries real
// runtime evidence bound to the candidate commit. Without this gate the target
// is an aspiration that any edit can silently claim; with it, a raised score
// requires a receipt.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export const EXPECTED_CATEGORY_COUNT = 35;
export const EVIDENCE_LEVELS = Object.freeze([
  'STATIC',
  'AUTOMATED',
  'RUNTIME_VERIFIED',
]);
const SHA_PATTERN = /^[a-f0-9]{40}$/u;

export function validateScorecard(scorecard) {
  const violations = [];
  const push = (message) => violations.push(message);

  if (scorecard?.schemaVersion !== 1) push('schemaVersion must be 1');
  if (!SHA_PATTERN.test(scorecard?.commitSha ?? '')) {
    push('commitSha must be a full 40-character commit SHA');
  }
  if (typeof scorecard?.targetScore !== 'number') {
    push('targetScore must be a number');
  }
  if (!['GO', 'CONDITIONAL_GO', 'NO-GO'].includes(scorecard?.verdict)) {
    push('verdict must be GO, CONDITIONAL_GO or NO-GO');
  }

  const categories = scorecard?.categories;
  if (!Array.isArray(categories)) {
    push('categories must be an array');
    return violations;
  }
  if (categories.length !== EXPECTED_CATEGORY_COUNT) {
    push(
      `categories must contain exactly ${EXPECTED_CATEGORY_COUNT} entries, found ${categories.length}`,
    );
  }

  const target = scorecard.targetScore;
  const seenIds = new Set();
  const seenNames = new Set();
  let belowTarget = 0;

  for (const category of categories) {
    const label = `category ${category?.id ?? '?'}`;

    if (!Number.isInteger(category?.id) || category.id < 1) {
      push(`${label} must have a positive integer id`);
    } else if (seenIds.has(category.id)) {
      push(`${label} is duplicated`);
    } else {
      seenIds.add(category.id);
    }

    if (typeof category?.name !== 'string' || category.name.trim() === '') {
      push(`${label} must have a name`);
    } else if (seenNames.has(category.name)) {
      push(`${label} reuses the name of another category`);
    } else {
      seenNames.add(category.name);
    }

    if (
      typeof category?.score !== 'number' ||
      category.score < 0 ||
      category.score > 10
    ) {
      push(`${label} score must be a number between 0 and 10`);
      continue;
    }

    if (!EVIDENCE_LEVELS.includes(category?.evidenceLevel)) {
      push(`${label} evidenceLevel must be one of ${EVIDENCE_LEVELS.join(', ')}`);
    }

    if (!Array.isArray(category?.automatedEvidence)) {
      push(`${label} automatedEvidence must be an array`);
    }
    if (!Array.isArray(category?.runtimeEvidence)) {
      push(`${label} runtimeEvidence must be an array`);
      continue;
    }

    if (typeof category?.gap !== 'string' || category.gap.trim() === '') {
      push(`${label} must state its remaining gap`);
    }

    // The honesty rule.
    if (category.score >= target) {
      if (category.evidenceLevel !== 'RUNTIME_VERIFIED') {
        push(
          `${label} claims ${category.score} but evidenceLevel is ${category.evidenceLevel}; the target requires RUNTIME_VERIFIED`,
        );
      }
      if (category.runtimeEvidence.length === 0) {
        push(
          `${label} claims ${category.score} without any runtime evidence receipt`,
        );
      }
    } else {
      belowTarget += 1;
    }

    if (
      category.evidenceLevel === 'RUNTIME_VERIFIED' &&
      category.runtimeEvidence.length === 0
    ) {
      push(`${label} is marked RUNTIME_VERIFIED but lists no receipt`);
    }
  }

  // A release cannot be declared GO while any category is short of the target.
  if (belowTarget > 0 && scorecard.verdict === 'GO') {
    push(
      `verdict is GO but ${belowTarget} categories are below the ${target} target`,
    );
  }

  return violations;
}

function main() {
  const scorecardPath = path.join(
    repositoryRoot,
    'quality',
    'release-scorecard.json',
  );
  let scorecard;
  try {
    scorecard = JSON.parse(readFileSync(scorecardPath, 'utf8'));
  } catch (error) {
    console.error(`[release-scorecard] Unreadable scorecard: ${error.message}`);
    process.exit(1);
  }

  const violations = validateScorecard(scorecard);
  if (violations.length > 0) {
    console.error(`[release-scorecard] Failed:\n- ${violations.join('\n- ')}`);
    process.exit(1);
  }

  const below = scorecard.categories.filter(
    (category) => category.score < scorecard.targetScore,
  ).length;
  console.log(
    `[release-scorecard] OK (${scorecard.categories.length} categories, ${below} below the ${scorecard.targetScore} target, verdict ${scorecard.verdict})`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
