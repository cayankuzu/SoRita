import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  REQUIRED_RUNTIME_CHECKS,
  REQUIRED_SCENARIOS,
  canonicalizeRuntimeReceipt,
  runtimeReceiptSigningBytes,
  stageRuntimeEvidence,
  verifyRuntimeEvidence,
} from "./runtime-evidence.mjs";

const now = new Date("2026-08-31T12:00:00.000Z");
const signingKeys = generateKeyPairSync("ed25519");
const publicKeyDer = signingKeys.publicKey.export({ format: "der", type: "spki" });
const publicKeySpkiBase64 = publicKeyDer.toString("base64");
const keyId = `sha256:${createHash("sha256").update(publicKeyDer).digest("hex")}`;
const expected = {
  repository: "https://github.com/cayankuzu/SoRita",
  commitSha: "a".repeat(40),
  runtimeVersion: "1.0.102",
  runId: 12345,
  runAttempt: 2,
  publicKeySpkiBase64,
  keyId,
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

function executionId(check) {
  const index = REQUIRED_RUNTIME_CHECKS.indexOf(check) + 1;
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function receipt(check) {
  const definition = definitions[check];
  const subjects = definition.subjects.map((descriptor, index) =>
    buildSubject(check, descriptor, index),
  );
  return {
    schemaVersion: 3,
    check,
    repository: expected.repository,
    commitSha: expected.commitSha,
    runtimeVersion: expected.runtimeVersion,
    observedAt: "2026-08-31T11:00:00.000Z",
    result: "pass",
    probe: {
      id: definition.probe,
      version: "3.0.0",
    },
    producer: {
      id: "sorita-runtime-probe-harness",
      version: "3.4.1",
      sourceSha256: digest("external-harness-source"),
      artifactSha256: digest("external-harness-artifact"),
      buildProvenanceUri: "https://evidence.example.test/builds/runtime-harness-3.4.1",
      executionId: executionId(check),
      keyId,
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

function writeReceipt(directory, value, privateKey = signingKeys.privateKey) {
  writeFileSync(
    join(directory, `${value.check}.json`),
    canonicalizeRuntimeReceipt(value),
  );
  const signature = sign(null, runtimeReceiptSigningBytes(value), privateKey);
  writeFileSync(
    join(directory, `${value.check}.sig`),
    `${signature.toString("base64")}\n`,
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

function outputFixture(prefix) {
  return join(mkdtempSync(join(tmpdir(), prefix)), "packet");
}

test("canonical receipt encoding is deterministic and rejects invalid Unicode", () => {
  assert.equal(
    canonicalizeRuntimeReceipt({ z: 1e30, a: [true, null, -0], m: "é" }),
    '{"a":[true,null,0],"m":"é","z":1e+30}',
  );
  assert.throws(
    () => canonicalizeRuntimeReceipt({ invalid: "\ud800" }),
    /unpaired high surrogate/u,
  );
});

test("runtime v3 schemas and executable check list remain identical", () => {
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
  assert.equal(manifestSchema.properties.schemaVersion.const, 2);
  assert.equal(receiptSchema.properties.schemaVersion.const, 3);
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
  assert.deepEqual(
    receiptSchema.properties.producer.required,
    [
      "id",
      "version",
      "sourceSha256",
      "artifactSha256",
      "buildProvenanceUri",
      "executionId",
      "keyId",
    ],
  );
});

test("stages signed canonical receipts and binds every receipt and signature hash", () => {
  const outputDirectory = outputFixture("sorita-runtime-output-");
  const staged = stageRuntimeEvidence({
    sourceDirectory: sourceFixture(),
    outputDirectory,
    expected,
    now,
  });
  assert.equal(staged.schemaVersion, 2);
  assert.equal(staged.signingKeyId, keyId);
  assert.equal(staged.artifacts.length, REQUIRED_RUNTIME_CHECKS.length);
  assert.equal(staged.artifacts[0].signature.bytes, 89);
  assert.match(staged.artifacts[0].receipt.sha256, /^[a-f0-9]{64}$/u);
  assert.match(staged.artifacts[0].signature.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    verifyRuntimeEvidence({ packetDirectory: outputDirectory, expected, now })
      .commitSha,
    expected.commitSha,
  );

  const changedPath = join(outputDirectory, "evidence", "cloudflare-preview.json");
  writeFileSync(changedPath, `${readFileSync(changedPath, "utf8")} `);
  assert.throws(
    () => verifyRuntimeEvidence({ packetDirectory: outputDirectory, expected, now }),
    /byte count changed|checksum changed/u,
  );
});

test("rejects unsigned changes, wrong keys, malformed signatures, and missing signatures", () => {
  const changedSource = sourceFixture();
  const changed = receipt("cloudflare-preview");
  changed.observedAt = "2026-08-31T11:30:00.000Z";
  writeFileSync(
    join(changedSource, "cloudflare-preview.json"),
    canonicalizeRuntimeReceipt(changed),
  );
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: changedSource,
        outputDirectory: outputFixture("sorita-runtime-unsigned-"),
        expected,
        now,
      }),
    /Ed25519 signature is invalid/u,
  );

  const otherKeys = generateKeyPairSync("ed25519");
  const otherSpki = otherKeys.publicKey.export({ format: "der", type: "spki" });
  const otherExpected = {
    ...expected,
    publicKeySpkiBase64: otherSpki.toString("base64"),
    keyId: `sha256:${digest(otherSpki)}`,
  };
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: sourceFixture(),
        outputDirectory: outputFixture("sorita-runtime-wrong-key-"),
        expected: otherExpected,
        now,
      }),
    /signing key does not match|Ed25519 signature is invalid/u,
  );

  const malformedSource = sourceFixture();
  writeFileSync(
    join(malformedSource, "cloudflare-preview.sig"),
    `${Buffer.alloc(64).toString("base64")}\n`,
  );
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: malformedSource,
        outputDirectory: outputFixture("sorita-runtime-bad-signature-"),
        expected,
        now,
      }),
    /Ed25519 signature is invalid/u,
  );

  const missingSource = sourceFixture();
  unlinkSync(join(missingSource, "cloudflare-preview.sig"));
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: missingSource,
        outputDirectory: outputFixture("sorita-runtime-missing-signature-"),
        expected,
        now,
      }),
    /signature is missing/u,
  );
});

test("rejects noncanonical receipt bytes and legacy v2 receipts", () => {
  const noncanonicalSource = sourceFixture();
  const value = receipt("cloudflare-preview");
  writeFileSync(
    join(noncanonicalSource, "cloudflare-preview.json"),
    `${JSON.stringify(value, null, 2)}\n`,
  );
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: noncanonicalSource,
        outputDirectory: outputFixture("sorita-runtime-noncanonical-"),
        expected,
        now,
      }),
    /not canonical JSON/u,
  );

  const legacySource = sourceFixture();
  const legacy = receipt("cloudflare-preview");
  legacy.schemaVersion = 2;
  legacy.probe = {
    id: "cloudflare-preview-health",
    version: "2.0.0",
    sourcePath: "utils/release-evidence/runtime-evidence.mjs",
    sourceSha256: digest("legacy-validator"),
  };
  writeReceipt(legacySource, legacy);
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: legacySource,
        outputDirectory: outputFixture("sorita-runtime-v2-"),
        expected,
        now,
      }),
    /violates JSON Schema/u,
  );
});

test("signed raw-artifact hashes fail closed when evidence bytes change", () => {
  const sourceDirectory = sourceFixture();
  const artifactPath = join(
    sourceDirectory,
    "raw",
    "cloudflare-preview",
    "preview-health.json",
  );
  writeFileSync(artifactPath, `${readFileSync(artifactPath, "utf8")}tampered`);
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory,
        outputDirectory: outputFixture("sorita-runtime-raw-tamper-"),
        expected,
        now,
      }),
    /raw artifact byte count changed|raw artifact checksum changed/u,
  );
});

test("rejects stale, mismatched, incomplete, and duplicated signed evidence", () => {
  const staleSource = sourceFixture();
  const stale = receipt("physical-device-matrix");
  stale.observedAt = "2026-08-01T00:00:00.000Z";
  writeReceipt(staleSource, stale);
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: staleSource,
        outputDirectory: outputFixture("sorita-runtime-stale-"),
        expected,
        now,
      }),
    /older than the 72-hour/u,
  );

  const mismatchedSource = sourceFixture();
  const mismatched = receipt("signed-android-ios");
  mismatched.commitSha = "c".repeat(40);
  writeReceipt(mismatchedSource, mismatched);
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: mismatchedSource,
        outputDirectory: outputFixture("sorita-runtime-sha-"),
        expected,
        now,
      }),
    /commit does not match/u,
  );

  const duplicateSubjectSource = sourceFixture();
  const duplicated = receipt("signed-android-ios");
  duplicated.subjects[1] = { ...duplicated.subjects[0] };
  writeReceipt(duplicateSubjectSource, duplicated);
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: duplicateSubjectSource,
        outputDirectory: outputFixture("sorita-runtime-duplicate-subject-"),
        expected,
        now,
      }),
    /exactly one eas-build\/(?:android|ios)/u,
  );

  const duplicateExecutionSource = sourceFixture();
  const duplicateExecution = receipt("security-review");
  duplicateExecution.producer.executionId = executionId("cloudflare-preview");
  writeReceipt(duplicateExecutionSource, duplicateExecution);
  assert.throws(
    () =>
      stageRuntimeEvidence({
        sourceDirectory: duplicateExecutionSource,
        outputDirectory: outputFixture("sorita-runtime-duplicate-execution-"),
        expected,
        now,
      }),
    /reuse a producer execution ID/u,
  );
});

test("manifest rejects duplicate signature paths and a changed signing key ID", () => {
  const outputDirectory = outputFixture("sorita-runtime-manifest-negative-");
  stageRuntimeEvidence({
    sourceDirectory: sourceFixture(),
    outputDirectory,
    expected,
    now,
  });
  const manifestPath = join(outputDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.artifacts[1].signature.path = manifest.artifacts[0].signature.path;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(
    () => verifyRuntimeEvidence({ packetDirectory: outputDirectory, expected, now }),
    /paths do not match|Duplicate runtime artifact path/u,
  );

  const otherOutput = outputFixture("sorita-runtime-manifest-key-");
  stageRuntimeEvidence({
    sourceDirectory: sourceFixture(),
    outputDirectory: otherOutput,
    expected,
    now,
  });
  const otherManifestPath = join(otherOutput, "manifest.json");
  const otherManifest = JSON.parse(readFileSync(otherManifestPath, "utf8"));
  otherManifest.signingKeyId = `sha256:${"f".repeat(64)}`;
  writeFileSync(otherManifestPath, `${JSON.stringify(otherManifest, null, 2)}\n`);
  assert.throws(
    () => verifyRuntimeEvidence({ packetDirectory: otherOutput, expected, now }),
    /manifest signing key does not match/u,
  );
});
