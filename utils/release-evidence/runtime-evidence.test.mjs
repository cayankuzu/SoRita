import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  REQUIRED_RUNTIME_CHECKS,
  REQUIRED_SCENARIOS,
  RUNTIME_PROBE_SOURCE_PATH,
  RUNTIME_PROBE_SOURCE_SHA256,
  stageRuntimeEvidence,
  verifyRuntimeEvidence,
} from "./runtime-evidence.mjs";

const now = new Date("2026-08-31T12:00:00.000Z");
const expected = {
  repository: "https://github.com/cayankuzu/SoRita",
  commitSha: "a".repeat(40),
  runtimeVersion: "1.0.102",
  runId: 12345,
  runAttempt: 2,
};

const definitions = {
  "cloudflare-preview": {
    probe: "cloudflare-preview-health",
    subjects: [["cloudflare-deployment", "cloudflare", "preview"]],
  },
  "signed-android-ios": {
    probe: "eas-signed-builds",
    subjects: [
      ["eas-build", "android", "production"],
      ["eas-build", "ios", "production"],
    ],
  },
  "ota-code-signing": {
    probe: "expo-update-code-signing",
    subjects: [["code-signing-certificate", "cross-platform", "production"]],
  },
  "physical-device-matrix": {
    probe: "physical-device-matrix",
    subjects: [
      ["physical-device", "android", "production"],
      ["physical-device", "ios", "production"],
    ],
  },
  "provider-dashboards": {
    probe: "provider-control-plane",
    subjects: [
      ["provider-control-plane", "cloudflare", "production"],
      ["provider-control-plane", "eas", "production"],
      ["provider-control-plane", "supabase", "production"],
      ["provider-control-plane", "sentry", "production"],
      ["provider-control-plane", "android", "production"],
      ["provider-control-plane", "ios", "production"],
    ],
  },
  "staging-restore": {
    probe: "supabase-staging-restore",
    subjects: [["supabase-restore", "database", "staging"]],
  },
  "store-internal-tracks": {
    probe: "store-internal-tracks",
    subjects: [
      ["store-track", "android", "production"],
      ["store-track", "ios", "production"],
    ],
  },
  "ota-preview-rollback": {
    probe: "ota-preview-rollback",
    subjects: [
      ["eas-update", "cross-platform", "preview"],
      ["physical-device", "android", "preview"],
      ["physical-device", "ios", "preview"],
    ],
  },
  "backup-pitr": {
    probe: "backup-pitr-restore",
    subjects: [
      ["supabase-backup", "database", "production"],
      ["supabase-restore", "database", "staging"],
    ],
  },
  "observability-alerts": {
    probe: "observability-alert-delivery",
    subjects: [["observability-alert", "sentry", "production"]],
  },
  "security-review": {
    probe: "security-review-toolchain",
    subjects: [["security-report", "github", "production"]],
  },
};

const BINARY_SUBJECT_KINDS = new Set([
  "eas-build",
  "physical-device",
  "store-track",
]);

function digest(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

function buildSubject(check, [kind, platform, environment], index) {
  const id = `${check}-${index + 1}`;
  const subject = {
    kind,
    id,
    platform,
    environment,
    sourceCommitSha: expected.commitSha,
    artifactSha256: digest(`artifact:${id}`),
    providerRecordId: `record-${id}`,
  };
  if (BINARY_SUBJECT_KINDS.has(kind)) {
    subject.binarySha256 = digest(`binary:${id}`);
    subject.appIdentifier = "com.sorita.app";
    subject.buildVersion = expected.runtimeVersion;
  }
  if (kind === "physical-device") {
    subject.deviceClass = `${platform}-reference-device`;
    subject.osVersion = "18.0";
  }
  return subject;
}

function rawArtifactBody(check, scenario) {
  return `${JSON.stringify({ check, scenario, result: "pass" })}\n`;
}

function receipt(check) {
  const definition = definitions[check];
  const subjects = definition.subjects.map((descriptor, index) =>
    buildSubject(check, descriptor, index),
  );
  return {
    schemaVersion: 2,
    check,
    repository: expected.repository,
    commitSha: expected.commitSha,
    runtimeVersion: expected.runtimeVersion,
    observedAt: "2026-08-31T11:00:00.000Z",
    result: "pass",
    probe: {
      id: definition.probe,
      version: "2.0.0",
      sourcePath: RUNTIME_PROBE_SOURCE_PATH,
      sourceSha256: RUNTIME_PROBE_SOURCE_SHA256,
    },
    subjects,
    scenarios: REQUIRED_SCENARIOS[check].map((scenario) => {
      const body = rawArtifactBody(check, scenario);
      return {
        id: scenario,
        result: "pass",
        subjectIds: [subjects[0].id],
        rawArtifact: {
          path: `raw/${check}/${scenario}.json`,
          mediaType: "application/json",
          bytes: Buffer.byteLength(body),
          sha256: digest(body),
          piiReview: "pass",
        },
      };
    }),
  };
}

function writeReceipt(directory, value) {
  writeFileSync(
    join(directory, `${value.check}.json`),
    `${JSON.stringify(value)}\n`,
  );
  for (const scenario of value.scenarios) {
    const artifactPath = join(directory, scenario.rawArtifact.path);
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, rawArtifactBody(value.check, scenario.id));
  }
}

function sourceFixture() {
  const directory = mkdtempSync(join(tmpdir(), "sorita-runtime-source-"));
  for (const check of REQUIRED_RUNTIME_CHECKS) {
    writeReceipt(directory, receipt(check));
  }
  return directory;
}

test("runtime schemas and executable check list remain identical", () => {
  const manifestSchema = JSON.parse(
    readFileSync(
      join(process.cwd(), "release-evidence", "runtime-manifest.schema.json"),
      "utf8",
    ),
  );
  const receiptSchema = JSON.parse(
    readFileSync(
      join(process.cwd(), "release-evidence", "runtime-receipt.schema.json"),
      "utf8",
    ),
  );
  assert.deepEqual(
    manifestSchema.properties.checks.required,
    REQUIRED_RUNTIME_CHECKS,
  );
  assert.deepEqual(
    Object.keys(manifestSchema.properties.checks.properties),
    REQUIRED_RUNTIME_CHECKS,
  );
  assert.deepEqual(
    manifestSchema.properties.artifacts.items.properties.check.enum,
    REQUIRED_RUNTIME_CHECKS,
  );
  assert.deepEqual(
    receiptSchema.properties.check.enum,
    REQUIRED_RUNTIME_CHECKS,
  );
});

test("stages canonical receipts and verifies every checksum and release identity", () => {
  const sourceDirectory = sourceFixture();
  const outputDirectory = join(
    mkdtempSync(join(tmpdir(), "sorita-runtime-output-")),
    "packet",
  );
  const staged = stageRuntimeEvidence({
    sourceDirectory,
    outputDirectory,
    expected,
    now,
  });
  assert.equal(staged.artifacts.length, REQUIRED_RUNTIME_CHECKS.length);
  assert.equal(
    verifyRuntimeEvidence({ packetDirectory: outputDirectory, expected, now })
      .commitSha,
    expected.commitSha,
  );

  const changedPath = join(
    outputDirectory,
    "evidence",
    "cloudflare-preview.json",
  );
  writeFileSync(changedPath, `${readFileSync(changedPath, "utf8")} `);
  assert.throws(
    () =>
      verifyRuntimeEvidence({
        packetDirectory: outputDirectory,
        expected,
        now,
      }),
    /byte count changed|checksum changed/u,
  );
});

test("rejects stale, mismatched, incomplete, and duplicated machine evidence", () => {
  const sourceDirectory = sourceFixture();
  const stale = receipt("physical-device-matrix");
  stale.observedAt = "2026-08-01T00:00:00.000Z";
  writeFileSync(
    join(sourceDirectory, "physical-device-matrix.json"),
    `${JSON.stringify(stale)}\n`,
  );
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory,
        outputDirectory: join(
          mkdtempSync(join(tmpdir(), "sorita-runtime-stale-")),
          "packet",
        ),
        expected,
        now,
      }),
    /older than the 72-hour/u,
  );

  const mismatchedSource = sourceFixture();
  const mismatched = receipt("signed-android-ios");
  mismatched.commitSha = "c".repeat(40);
  writeFileSync(
    join(mismatchedSource, "signed-android-ios.json"),
    `${JSON.stringify(mismatched)}\n`,
  );
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: mismatchedSource,
        outputDirectory: join(
          mkdtempSync(join(tmpdir(), "sorita-runtime-sha-")),
          "packet",
        ),
        expected,
        now,
      }),
    /commit does not match/u,
  );

  const duplicateSource = sourceFixture();
  const duplicated = receipt("signed-android-ios");
  duplicated.subjects[1] = { ...duplicated.subjects[0] };
  writeFileSync(
    join(duplicateSource, "signed-android-ios.json"),
    `${JSON.stringify(duplicated)}\n`,
  );
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: duplicateSource,
        outputDirectory: join(
          mkdtempSync(join(tmpdir(), "sorita-runtime-duplicate-")),
          "packet",
        ),
        expected,
        now,
      }),
    /exactly one eas-build\/(?:android|ios)/u,
  );
});
