import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  EXPECTED_CATEGORY_COUNT,
  validateScorecard,
} from "../check-release-scorecard.mjs";

function baseline() {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "quality", "release-scorecard.json"),
      "utf8",
    ),
  );
}

test("the checked-in scorecard satisfies every rule", () => {
  assert.deepEqual(validateScorecard(baseline()), []);
});

test("the checked-in scorecard covers all 35 categories with unique ids", () => {
  const scorecard = baseline();
  assert.equal(scorecard.categories.length, EXPECTED_CATEGORY_COUNT);
  const ids = scorecard.categories.map((category) => category.id);
  assert.equal(new Set(ids).size, EXPECTED_CATEGORY_COUNT);
  const names = scorecard.categories.map((category) => category.name);
  assert.equal(new Set(names).size, EXPECTED_CATEGORY_COUNT);
});

test("a category cannot reach the target without runtime evidence", () => {
  const scorecard = baseline();
  scorecard.categories[0].score = 9.9;
  const violations = validateScorecard(scorecard);
  assert.ok(
    violations.some((violation) => violation.includes("requires RUNTIME_VERIFIED")),
    "raising a score above the target without runtime evidence must fail",
  );
  assert.ok(
    violations.some((violation) =>
      violation.includes("without any runtime evidence receipt"),
    ),
  );
});

test("a category marked RUNTIME_VERIFIED must carry a receipt", () => {
  const scorecard = baseline();
  scorecard.categories[0].evidenceLevel = "RUNTIME_VERIFIED";
  const violations = validateScorecard(scorecard);
  assert.ok(
    violations.some((violation) => violation.includes("lists no receipt")),
  );
});

test("a category at the target with a real receipt is accepted", () => {
  const scorecard = baseline();
  scorecard.categories[0].score = 9.9;
  scorecard.categories[0].evidenceLevel = "RUNTIME_VERIFIED";
  scorecard.categories[0].runtimeEvidence = ["evidence/physical-device-matrix.json"];
  assert.deepEqual(validateScorecard(scorecard), []);
});

test("GO is rejected while any category is below the target", () => {
  const scorecard = baseline();
  scorecard.verdict = "GO";
  const violations = validateScorecard(scorecard);
  assert.ok(
    violations.some((violation) => violation.includes("verdict is GO but")),
  );
});

test("structural defects fail closed", () => {
  const missingCategory = baseline();
  missingCategory.categories.pop();
  assert.ok(
    validateScorecard(missingCategory).some((violation) =>
      violation.includes("exactly 35 entries"),
    ),
  );

  const duplicated = baseline();
  duplicated.categories[1].id = duplicated.categories[0].id;
  assert.ok(
    validateScorecard(duplicated).some((violation) =>
      violation.includes("is duplicated"),
    ),
  );

  const badSha = baseline();
  badSha.commitSha = "not-a-sha";
  assert.ok(
    validateScorecard(badSha).some((violation) =>
      violation.includes("40-character commit SHA"),
    ),
  );

  const badLevel = baseline();
  badLevel.categories[2].evidenceLevel = "PROBABLY_FINE";
  assert.ok(
    validateScorecard(badLevel).some((violation) =>
      violation.includes("evidenceLevel must be one of"),
    ),
  );

  const noGap = baseline();
  noGap.categories[3].gap = "";
  assert.ok(
    validateScorecard(noGap).some((violation) =>
      violation.includes("must state its remaining gap"),
    ),
  );

  const outOfRange = baseline();
  outOfRange.categories[4].score = 42;
  assert.ok(
    validateScorecard(outOfRange).some((violation) =>
      violation.includes("between 0 and 10"),
    ),
  );
});
