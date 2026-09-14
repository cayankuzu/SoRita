#!/usr/bin/env node

import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";

export const REQUIRED_RUNTIME_CHECKS = Object.freeze([
  "cloudflare-preview",
  "signed-android-ios",
  "ota-code-signing",
  "physical-device-matrix",
  "provider-dashboards",
  "staging-restore",
  "store-internal-tracks",
  "ota-preview-rollback",
  "backup-pitr",
  "observability-alerts",
  "security-review",
]);

export const REQUIRED_SCENARIOS = Object.freeze({
  "cloudflare-preview": Object.freeze([
    "preview-health",
    "route-contract",
    "origin-hmac-observe",
    "origin-hmac-enforce",
    "deployment-rollback",
  ]),
  "signed-android-ios": Object.freeze([
    "android-artifact-inspection",
    "ios-artifact-inspection",
    "android-signing-continuity",
    "ios-signing-continuity",
    "source-provenance",
  ]),
  "ota-code-signing": Object.freeze([
    "valid-signature",
    "invalid-signature-rejected",
    "certificate-fingerprint",
    "key-rotation",
  ]),
  "physical-device-matrix": Object.freeze([
    "ios-current-foreground",
    "ios-current-background",
    "ios-current-terminated",
    "ios-supported-old",
    "android-pixel-foreground",
    "android-samsung-background",
    "android-low-terminated",
    "permission-denied-to-allowed",
    "logout-user-switch",
    "token-rotation",
    "offline-online",
    "provider-429",
    "provider-5xx",
    "invalid-credentials",
    "unregistered-token",
    "duplicate-provider-response",
    "authorized-target-tap",
    "blocked-target-fallback",
    "app-update-token-continuity",
  ]),
  "provider-dashboards": Object.freeze([
    "cloudflare-control-plane",
    "eas-control-plane",
    "supabase-control-plane",
    "sentry-control-plane",
    "fcm-v1-control-plane",
    "apns-production-control-plane",
  ]),
  "staging-restore": Object.freeze([
    "migration-replay",
    "rls-idor-personas",
    "dump-restore",
    "schema-policy-parity",
    "storage-metadata-parity",
  ]),
  "store-internal-tracks": Object.freeze([
    "play-internal-track",
    "testflight-track",
    "android-install-smoke",
    "ios-install-smoke",
  ]),
  "ota-preview-rollback": Object.freeze([
    "preview-update-publish",
    "android-update-apply",
    "ios-update-apply",
    "same-runtime-rollback",
    "embedded-update-fallback",
    "channel-mapping-restore",
  ]),
  "backup-pitr": Object.freeze([
    "provider-backup-enabled",
    "rpo-observed",
    "pitr-restore-staging",
    "rto-observed",
    "private-media-recovery",
  ]),
  "observability-alerts": Object.freeze([
    "release-sha-correlation",
    "pii-redaction-sample",
    "alert-fire",
    "alert-delivery",
    "alert-recovery",
  ]),
  "security-review": Object.freeze([
    "full-history-secret-scan",
    "sast",
    "dependency-audit",
    "sbom-provenance",
    "threat-review",
  ]),
});

const EXPECTED_PROBES = Object.freeze({
  "cloudflare-preview": "cloudflare-preview-health",
  "signed-android-ios": "eas-signed-builds",
  "ota-code-signing": "expo-update-code-signing",
  "physical-device-matrix": "physical-device-matrix",
  "provider-dashboards": "provider-control-plane",
  "staging-restore": "supabase-staging-restore",
  "store-internal-tracks": "store-internal-tracks",
  "ota-preview-rollback": "ota-preview-rollback",
  "backup-pitr": "backup-pitr-restore",
  "observability-alerts": "observability-alert-delivery",
  "security-review": "security-review-toolchain",
});

const REQUIRED_SUBJECTS = Object.freeze({
  "cloudflare-preview": [["cloudflare-deployment", "cloudflare", "preview"]],
  "signed-android-ios": [
    ["eas-build", "android", "production"],
    ["eas-build", "ios", "production"],
  ],
  "ota-code-signing": [
    ["code-signing-certificate", "cross-platform", "production"],
  ],
  "physical-device-matrix": [
    ["physical-device", "android", "production"],
    ["physical-device", "ios", "production"],
  ],
  "provider-dashboards": [
    ["provider-control-plane", "cloudflare", "production"],
    ["provider-control-plane", "eas", "production"],
    ["provider-control-plane", "supabase", "production"],
    ["provider-control-plane", "sentry", "production"],
    ["provider-control-plane", "android", "production"],
    ["provider-control-plane", "ios", "production"],
  ],
  "staging-restore": [["supabase-restore", "database", "staging"]],
  "store-internal-tracks": [
    ["store-track", "android", "production"],
    ["store-track", "ios", "production"],
  ],
  "ota-preview-rollback": [
    ["eas-update", "cross-platform", "preview"],
    ["physical-device", "android", "preview"],
    ["physical-device", "ios", "preview"],
  ],
  "backup-pitr": [
    ["supabase-backup", "database", "production"],
    ["supabase-restore", "database", "staging"],
  ],
  "observability-alerts": [["observability-alert", "sentry", "production"]],
  "security-review": [["security-report", "github", "production"]],
});

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const manifestSchema = JSON.parse(
  readFileSync(
    resolve(
      moduleDirectory,
      "../../release-evidence/runtime-manifest.schema.json",
    ),
    "utf8",
  ),
);
const receiptSchema = JSON.parse(
  readFileSync(
    resolve(
      moduleDirectory,
      "../../release-evidence/runtime-receipt.schema.json",
    ),
    "utf8",
  ),
);
const ajv = new Ajv({ allErrors: true, jsonPointers: true, schemaId: "auto" });
const validateManifest = ajv.compile(manifestSchema);
const validateReceipt = ajv.compile(receiptSchema);

export const RUNTIME_RECEIPT_DOMAIN_SEPARATOR = Buffer.from(
  "sorita-runtime-evidence-receipt-v3\0",
  "utf8",
);

function fail(message) {
  throw new Error(message);
}

function schemaError(prefix, validator) {
  const details = (validator.errors ?? [])
    .map((error) => `${error.dataPath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
  fail(`${prefix} violates JSON Schema: ${details}`);
}

function hashBuffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashFile(filePath) {
  return hashBuffer(readFileSync(filePath));
}

function assertWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        fail("Canonical JSON contains an unpaired high surrogate");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("Canonical JSON contains an unpaired low surrogate");
    }
  }
}

function canonicalizeJson(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("Canonical JSON contains a non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    assertWellFormedUnicode(value);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => {
        assertWellFormedUnicode(key);
        return `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`;
      });
    return `{${entries.join(",")}}`;
  }
  fail(`Canonical JSON cannot encode ${typeof value}`);
}

export function canonicalizeRuntimeReceipt(receipt) {
  return canonicalizeJson(receipt);
}

export function runtimeReceiptSigningBytes(receipt) {
  return Buffer.concat([
    RUNTIME_RECEIPT_DOMAIN_SEPARATOR,
    Buffer.from(canonicalizeRuntimeReceipt(receipt), "utf8"),
  ]);
}

function decodeCanonicalBase64(value, label, expectedLength) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 4096
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    fail(`${label} is not canonical base64`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) fail(`${label} is not canonical base64`);
  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    fail(`${label} has the wrong byte length`);
  }
  return decoded;
}

function createVerificationContext(expected) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(expected.keyId ?? "")) {
    fail("Expected runtime signing key ID is invalid");
  }
  const spki = decodeCanonicalBase64(
    expected.publicKeySpkiBase64,
    "Runtime signing public key",
  );
  let publicKey;
  try {
    publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
  } catch {
    fail("Runtime signing public key is not valid SPKI DER");
  }
  if (publicKey.asymmetricKeyType !== "ed25519") {
    fail("Runtime signing public key must be Ed25519");
  }
  const canonicalSpki = publicKey.export({ format: "der", type: "spki" });
  if (!Buffer.from(canonicalSpki).equals(spki)) {
    fail("Runtime signing public key is not canonical SPKI DER");
  }
  const derivedKeyId = `sha256:${hashBuffer(spki)}`;
  if (derivedKeyId !== expected.keyId) {
    fail("Runtime signing public key does not match the expected key ID");
  }
  return { keyId: derivedKeyId, publicKey };
}

function assertExpectedIdentity(value, expected, label) {
  if (value !== expected)
    fail(`${label} does not match the expected release identity`);
}

function assertRecentObservation(observedAt, now) {
  const observed = Date.parse(observedAt);
  const current = now.getTime();
  if (!Number.isFinite(observed)) fail("Runtime receipt observedAt is invalid");
  if (observed > current + 5 * 60_000)
    fail("Runtime receipt observedAt is in the future");
  if (observed < current - 72 * 60 * 60_000) {
    fail("Runtime receipt is older than the 72-hour release evidence window");
  }
}

function assertRequiredSubjects(receipt) {
  for (const [kind, platform, environment] of REQUIRED_SUBJECTS[
    receipt.check
  ]) {
    const matches = receipt.subjects.filter(
      (subject) =>
        subject.kind === kind &&
        subject.platform === platform &&
        subject.environment === environment,
    );
    if (matches.length !== 1) {
      fail(
        `${receipt.check} must contain exactly one ${kind}/${platform}/${environment} subject`,
      );
    }
  }

  const subjectIds = new Set(receipt.subjects.map((subject) => subject.id));
  if (subjectIds.size !== receipt.subjects.length) {
    fail(`${receipt.check} contains duplicate runtime subjects`);
  }

  for (const subject of receipt.subjects) {
    if (subject.sourceCommitSha !== receipt.commitSha) {
      fail(`${receipt.check} subject ${subject.id} is not bound to the candidate commit`);
    }
    if (["eas-build", "physical-device", "store-track"].includes(subject.kind)) {
      if (!subject.binarySha256 || !subject.appIdentifier || !subject.buildVersion) {
        fail(`${receipt.check} subject ${subject.id} is missing signed binary identity`);
      }
    }
    if (subject.kind === "physical-device" && (!subject.deviceClass || !subject.osVersion)) {
      fail(`${receipt.check} subject ${subject.id} is missing physical device identity`);
    }
  }
}

function assertScenarioContract(receipt) {
  const expectedScenarios = REQUIRED_SCENARIOS[receipt.check];
  const actualScenarios = receipt.scenarios.map((scenario) => scenario.id);
  const uniqueScenarios = new Set(actualScenarios);
  if (
    uniqueScenarios.size !== expectedScenarios.length
    || actualScenarios.length !== expectedScenarios.length
    || expectedScenarios.some((scenario) => !uniqueScenarios.has(scenario))
  ) {
    fail(`${receipt.check} does not contain its exact required runtime scenario matrix`);
  }

  const subjectIds = new Set(receipt.subjects.map((subject) => subject.id));
  const rawPaths = new Set();
  for (const scenario of receipt.scenarios) {
    if (scenario.subjectIds.some((subjectId) => !subjectIds.has(subjectId))) {
      fail(`${receipt.check}/${scenario.id} references an unknown runtime subject`);
    }
    if (!scenario.rawArtifact.path.startsWith(`raw/${receipt.check}/`)) {
      fail(`${receipt.check}/${scenario.id} raw artifact is outside its check directory`);
    }
    if (rawPaths.has(scenario.rawArtifact.path)) {
      fail(`${receipt.check} reuses a raw artifact across multiple scenarios`);
    }
    rawPaths.add(scenario.rawArtifact.path);
  }
}

function assertProducerContract(receipt, expected) {
  assertExpectedIdentity(
    receipt.producer.keyId,
    expected.keyId,
    "Runtime receipt signing key",
  );
  let provenanceUrl;
  try {
    provenanceUrl = new URL(receipt.producer.buildProvenanceUri);
  } catch {
    fail(`${receipt.check} producer build provenance URI is invalid`);
  }
  if (
    provenanceUrl.protocol !== "https:"
    || provenanceUrl.username
    || provenanceUrl.password
  ) {
    fail(`${receipt.check} producer build provenance must be credential-free HTTPS`);
  }
}

function producerIdentity(receipt) {
  const identity = { ...receipt.producer };
  delete identity.executionId;
  return canonicalizeJson(identity);
}

function assertPacketProducerContract(receipts, expected) {
  const identities = new Set(receipts.map(producerIdentity));
  if (identities.size !== 1) {
    fail("Runtime receipts do not share one signed harness producer identity");
  }
  const executionIds = receipts.map((receipt) => receipt.producer.executionId);
  if (new Set(executionIds).size !== executionIds.length) {
    fail("Runtime receipts reuse a producer execution ID");
  }
  if (receipts.some((receipt) => receipt.producer.keyId !== expected.keyId)) {
    fail("Runtime receipts do not share the expected signing key ID");
  }
}

export function validateRuntimeReceipt(receipt, expected, now = new Date()) {
  if (!validateReceipt(receipt))
    schemaError("Runtime receipt", validateReceipt);
  assertExpectedIdentity(
    receipt.check,
    expected.check,
    "Runtime receipt check",
  );
  assertExpectedIdentity(
    receipt.repository,
    expected.repository,
    "Runtime receipt repository",
  );
  assertExpectedIdentity(
    receipt.commitSha,
    expected.commitSha,
    "Runtime receipt commit",
  );
  assertExpectedIdentity(
    receipt.runtimeVersion,
    expected.runtimeVersion,
    "Runtime receipt runtime",
  );
  assertExpectedIdentity(
    receipt.probe.id,
    EXPECTED_PROBES[expected.check],
    "Runtime receipt probe",
  );
  assertProducerContract(receipt, expected);
  assertRecentObservation(receipt.observedAt, now);
  assertRequiredSubjects(receipt);
  assertScenarioContract(receipt);
  return receipt;
}

function resolveRawArtifact(root, check, artifact) {
  const artifactPath = resolve(root, artifact.path);
  const normalized = relative(root, artifactPath).replaceAll("\\", "/");
  if (normalized !== artifact.path || !normalized.startsWith(`raw/${check}/`)) {
    fail(`Runtime raw artifact path is not normalized: ${artifact.path}`);
  }
  if (!existsSync(artifactPath) || !statSync(artifactPath).isFile()) {
    fail(`Runtime raw artifact is missing: ${artifact.path}`);
  }
  if (lstatSync(artifactPath).isSymbolicLink()) {
    fail(`Runtime raw artifact cannot be a symlink: ${artifact.path}`);
  }
  const bytes = readFileSync(artifactPath);
  if (bytes.length !== artifact.bytes) {
    fail(`Runtime raw artifact byte count changed: ${artifact.path}`);
  }
  if (hashBuffer(bytes) !== artifact.sha256) {
    fail(`Runtime raw artifact checksum changed: ${artifact.path}`);
  }
  return bytes;
}

function stageRawArtifacts(source, output, receipt) {
  for (const scenario of receipt.scenarios) {
    const sourceBytes = resolveRawArtifact(source, receipt.check, scenario.rawArtifact);
    const outputPath = resolve(output, scenario.rawArtifact.path);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, sourceBytes, { flag: "wx" });
  }
}

function readSignatureFile(signaturePath) {
  if (!existsSync(signaturePath) || !statSync(signaturePath).isFile()) {
    fail(`Runtime receipt signature is missing: ${signaturePath}`);
  }
  if (lstatSync(signaturePath).isSymbolicLink()) {
    fail(`Runtime receipt signature cannot be a symlink: ${signaturePath}`);
  }
  const fileBytes = readFileSync(signaturePath);
  const encoded = fileBytes.toString("utf8");
  if (fileBytes.length !== 89 || !encoded.endsWith("\n")) {
    fail(`Runtime receipt signature is not one canonical base64 line: ${signaturePath}`);
  }
  const signature = decodeCanonicalBase64(
    encoded.slice(0, -1),
    "Runtime receipt signature",
    64,
  );
  return { fileBytes, signature };
}

function readReceipt(receiptPath, signaturePath, expected, verification, now) {
  if (!existsSync(receiptPath) || !statSync(receiptPath).isFile()) {
    fail(`Runtime receipt is missing: ${receiptPath}`);
  }
  if (lstatSync(receiptPath).isSymbolicLink())
    fail(`Runtime receipt cannot be a symlink: ${receiptPath}`);
  if (statSync(receiptPath).size > 1024 * 1024)
    fail(`Runtime receipt is too large: ${receiptPath}`);
  const receiptBytes = readFileSync(receiptPath);
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch {
    fail(`Runtime receipt is not valid JSON: ${receiptPath}`);
  }
  const canonicalBytes = Buffer.from(canonicalizeRuntimeReceipt(receipt), "utf8");
  if (!receiptBytes.equals(canonicalBytes)) {
    fail(`Runtime receipt is not canonical JSON: ${receiptPath}`);
  }
  validateRuntimeReceipt(receipt, expected, now);
  const signature = readSignatureFile(signaturePath);
  if (
    !verifySignature(
      null,
      runtimeReceiptSigningBytes(receipt),
      verification.publicKey,
      signature.signature,
    )
  ) {
    fail(`Runtime receipt Ed25519 signature is invalid: ${receiptPath}`);
  }
  return {
    receipt,
    receiptBytes,
    signatureBytes: signature.fileBytes,
  };
}

export function stageRuntimeEvidence({
  sourceDirectory,
  outputDirectory,
  expected,
  now = new Date(),
}) {
  const source = resolve(sourceDirectory);
  const output = resolve(outputDirectory);
  if (source === output)
    fail("Runtime evidence source and output directories must be different");
  if (!Number.isInteger(expected.runId) || expected.runId < 1)
    fail("Runtime workflow run ID is invalid");
  if (!Number.isInteger(expected.runAttempt) || expected.runAttempt < 1) {
    fail("Runtime workflow run attempt is invalid");
  }
  const verification = createVerificationContext(expected);

  const validatedReceipts = REQUIRED_RUNTIME_CHECKS.map((check) =>
    readReceipt(
      resolve(source, `${check}.json`),
      resolve(source, `${check}.sig`),
      { ...expected, check },
      verification,
      now,
    ),
  );
  assertPacketProducerContract(
    validatedReceipts.map(({ receipt }) => receipt),
    expected,
  );

  const stagedReceipts = [];
  for (const validated of validatedReceipts) {
    const { receipt, receiptBytes, signatureBytes } = validated;
    const check = receipt.check;
    stageRawArtifacts(source, output, receipt);
    const receiptPath = resolve(output, "evidence", `${check}.json`);
    const signaturePath = resolve(output, "evidence", `${check}.sig`);
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, receiptBytes, {
      flag: "wx",
    });
    writeFileSync(signaturePath, signatureBytes, { flag: "wx" });
    stagedReceipts.push({
      check,
      receipt: {
        path: `evidence/${check}.json`,
        mediaType: "application/vnd.sorita.runtime-probe+json",
        bytes: statSync(receiptPath).size,
        sha256: hashFile(receiptPath),
      },
      signature: {
        path: `evidence/${check}.sig`,
        mediaType: "application/vnd.sorita.ed25519-signature",
        bytes: statSync(signaturePath).size,
        sha256: hashFile(signaturePath),
        keyId: verification.keyId,
      },
    });
  }

  const manifest = {
    schemaVersion: 2,
    repository: expected.repository,
    commitSha: expected.commitSha,
    runtimeVersion: expected.runtimeVersion,
    generatedAt: now.toISOString(),
    workflow: {
      path: ".github/workflows/runtime-evidence.yml",
      runId: expected.runId,
      runAttempt: expected.runAttempt,
    },
    signingKeyId: verification.keyId,
    checks: Object.fromEntries(
      REQUIRED_RUNTIME_CHECKS.map((check) => [check, "pass"]),
    ),
    artifacts: stagedReceipts,
  };
  if (!validateManifest(manifest))
    schemaError("Runtime evidence manifest", validateManifest);
  mkdirSync(output, { recursive: true });
  writeFileSync(
    resolve(output, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    {
      flag: "wx",
    },
  );
  return manifest;
}

function resolvePacketArtifact(root, artifact) {
  const artifactPath = resolve(root, artifact.path);
  const normalized = relative(root, artifactPath).replaceAll("\\", "/");
  if (normalized !== artifact.path || normalized.startsWith("../")) {
    fail(`Runtime artifact path is not normalized: ${artifact.path}`);
  }
  return artifactPath;
}

function verifyPacketArtifact(root, artifact) {
  const artifactPath = resolvePacketArtifact(root, artifact);
  if (!existsSync(artifactPath) || !statSync(artifactPath).isFile()) {
    fail(`Runtime artifact is missing: ${artifact.path}`);
  }
  if (lstatSync(artifactPath).isSymbolicLink()) {
    fail(`Runtime artifact cannot be a symlink: ${artifact.path}`);
  }
  if (statSync(artifactPath).size !== artifact.bytes) {
    fail(`Runtime artifact byte count changed: ${artifact.path}`);
  }
  if (hashFile(artifactPath) !== artifact.sha256) {
    fail(`Runtime artifact checksum changed: ${artifact.path}`);
  }
  return artifactPath;
}

export function verifyRuntimeEvidence({
  packetDirectory,
  expected,
  now = new Date(),
}) {
  const root = resolve(packetDirectory);
  const verification = createVerificationContext(expected);
  const manifestPath = resolve(root, "manifest.json");
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    fail("Runtime evidence manifest is missing");
  }
  if (lstatSync(manifestPath).isSymbolicLink()) {
    fail("Runtime evidence manifest cannot be a symlink");
  }
  if (statSync(manifestPath).size > 1024 * 1024) {
    fail("Runtime evidence manifest is too large");
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("Runtime evidence manifest is not valid JSON");
  }
  if (!validateManifest(manifest))
    schemaError("Runtime evidence manifest", validateManifest);

  assertExpectedIdentity(
    manifest.repository,
    expected.repository,
    "Runtime manifest repository",
  );
  assertExpectedIdentity(
    manifest.commitSha,
    expected.commitSha,
    "Runtime manifest commit",
  );
  assertExpectedIdentity(
    manifest.runtimeVersion,
    expected.runtimeVersion,
    "Runtime manifest runtime",
  );
  assertExpectedIdentity(
    manifest.workflow.runId,
    expected.runId,
    "Runtime manifest workflow run",
  );
  assertExpectedIdentity(
    manifest.workflow.runAttempt,
    expected.runAttempt,
    "Runtime manifest workflow attempt",
  );
  assertExpectedIdentity(
    manifest.signingKeyId,
    verification.keyId,
    "Runtime manifest signing key",
  );
  assertRecentObservation(manifest.generatedAt, now);

  const seenChecks = new Set();
  const seenPaths = new Set();
  const receipts = [];
  for (const artifact of manifest.artifacts) {
    if (seenChecks.has(artifact.check))
      fail(`Duplicate runtime check artifact: ${artifact.check}`);
    const expectedReceiptPath = `evidence/${artifact.check}.json`;
    const expectedSignaturePath = `evidence/${artifact.check}.sig`;
    if (
      artifact.receipt.path !== expectedReceiptPath
      || artifact.signature.path !== expectedSignaturePath
    ) {
      fail(`Runtime artifact paths do not match check ${artifact.check}`);
    }
    for (const descriptor of [artifact.receipt, artifact.signature]) {
      if (seenPaths.has(descriptor.path)) {
        fail(`Duplicate runtime artifact path: ${descriptor.path}`);
      }
      seenPaths.add(descriptor.path);
    }
    seenChecks.add(artifact.check);
    assertExpectedIdentity(
      artifact.signature.keyId,
      verification.keyId,
      `Runtime ${artifact.check} signature key`,
    );
    const receiptPath = verifyPacketArtifact(root, artifact.receipt);
    const signaturePath = verifyPacketArtifact(root, artifact.signature);
    const validated = readReceipt(
      receiptPath,
      signaturePath,
      { ...expected, check: artifact.check },
      verification,
      now,
    );
    receipts.push(validated.receipt);
    for (const scenario of validated.receipt.scenarios) {
      resolveRawArtifact(root, validated.receipt.check, scenario.rawArtifact);
    }
  }
  if (seenChecks.size !== REQUIRED_RUNTIME_CHECKS.length) {
    fail("Runtime evidence packet does not cover every required runtime check");
  }
  assertPacketProducerContract(receipts, expected);
  return manifest;
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!["stage", "verify"].includes(command)) {
    fail("Usage: runtime-evidence.mjs <stage|verify> [options]");
  }
  const values = { command };
  for (let index = 0; index < tokens.length; index += 2) {
    const option = tokens[index];
    const value = tokens[index + 1];
    if (!option?.startsWith("--") || !value || value.startsWith("--")) {
      fail(`Missing value for ${option ?? "option"}`);
    }
    const name = option
      .slice(2)
      .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    if (Object.hasOwn(values, name)) fail(`Duplicate option: ${option}`);
    values[name] = value;
  }
  const required = [
    "directory",
    "repository",
    "commit",
    "runtime",
    "runId",
    "runAttempt",
    "publicKeySpkiBase64",
    "keyId",
  ];
  if (command === "stage") required.push("source");
  for (const name of required) if (!values[name]) fail(`--${name} is required`);
  return values;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const expected = {
    repository: options.repository,
    commitSha: options.commit,
    runtimeVersion: options.runtime,
    runId: Number(options.runId),
    runAttempt: Number(options.runAttempt),
    publicKeySpkiBase64: options.publicKeySpkiBase64,
    keyId: options.keyId,
  };
  const manifest =
    options.command === "stage"
      ? stageRuntimeEvidence({
          sourceDirectory: options.source,
          outputDirectory: options.directory,
          expected,
        })
      : verifyRuntimeEvidence({ packetDirectory: options.directory, expected });
  process.stdout.write(`${manifest.commitSha}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `runtime-evidence: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
