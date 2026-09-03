import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createManifest,
  parseArguments,
  REQUIRED_RELEASE_CHECKS,
  validateManifestSchema,
  verifyManifest,
} from "./manifest.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function repositoryFixture() {
  const cwd = mkdtempSync(join(tmpdir(), "sorita-evidence-"));
  git(cwd, "init", "--initial-branch=main");
  git(cwd, "config", "user.email", "evidence@example.invalid");
  git(cwd, "config", "user.name", "Evidence Test");
  mkdirSync(join(cwd, "artifacts"));
  writeFileSync(join(cwd, "tracked.txt"), "tracked\n");
  writeFileSync(join(cwd, ".gitignore"), "artifacts/\n");
  git(cwd, "add", ".");
  git(cwd, "commit", "-m", "fixture");
  writeFileSync(join(cwd, "artifacts", "test.log"), "PASS\n");
  return cwd;
}

function requiredResultArguments(state = "pass") {
  return REQUIRED_RELEASE_CHECKS.flatMap((name) => [
    "--result",
    `${name}=${state}`,
  ]);
}

test("argument parser requires named result states and artifacts", () => {
  const parsed = parseArguments([
    "create",
    "--manifest",
    "artifacts/manifest.json",
    "--artifact",
    "artifacts/test.log",
    "--result",
    "unit=pass",
  ]);
  assert.equal(parsed.command, "create");
  assert.deepEqual(parsed.results, [["unit", "pass"]]);
});

test("create and verify bind artifacts to a clean immutable commit", () => {
  const cwd = repositoryFixture();
  const options = parseArguments([
    "create",
    "--manifest",
    "artifacts/manifest.json",
    "--artifact",
    "artifacts/test.log",
    ...requiredResultArguments(),
  ]);
  const created = createManifest({
    cwd,
    options,
    now: new Date("2026-08-30T00:00:00.000Z"),
  });
  assert.equal(created.commitSha, git(cwd, "rev-parse", "HEAD"));
  assert.equal(created.artifacts[0].sha256.length, 64);
  assert.equal(
    verifyManifest({ cwd, manifestPath: options.manifest }).commitSha,
    created.commitSha,
  );

  writeFileSync(join(cwd, "artifacts", "test.log"), "CHANGED\n");
  assert.throws(
    () => verifyManifest({ cwd, manifestPath: options.manifest }),
    /artifact size changed|artifact checksum changed/u,
  );
});

test("creation fails closed when the working tree is dirty", () => {
  const cwd = repositoryFixture();
  writeFileSync(
    join(cwd, "tracked.txt"),
    `${readFileSync(join(cwd, "tracked.txt"), "utf8")}dirty\n`,
  );
  const options = parseArguments([
    "create",
    "--manifest",
    "artifacts/manifest.json",
    "--artifact",
    "artifacts/test.log",
    ...requiredResultArguments(),
  ]);
  assert.throws(
    () => createManifest({ cwd, options }),
    /clean Git working tree/u,
  );
});

test("verification rejects missing checks and repository-external artifact paths", () => {
  const cwd = repositoryFixture();
  const options = parseArguments([
    "create",
    "--manifest",
    "artifacts/manifest.json",
    "--artifact",
    "artifacts/test.log",
    ...requiredResultArguments(),
  ]);
  createManifest({ cwd, options });

  const manifestPath = join(cwd, "artifacts", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  delete manifest.checks["security-review"];
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  assert.throws(
    () => verifyManifest({ cwd, manifestPath: options.manifest }),
    /violates JSON Schema/u,
  );

  manifest.checks["security-review"] = "pass";
  manifest.artifacts[0].path = "../outside.log";
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  assert.throws(
    () => verifyManifest({ cwd, manifestPath: options.manifest }),
    /normalized repository-relative path/u,
  );
});

test("the executable validator enforces schema v2 and the exact required check set", () => {
  const schema = JSON.parse(
    readFileSync(
      join(process.cwd(), "release-evidence", "manifest.schema.json"),
      "utf8",
    ),
  );
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.deepEqual(schema.properties.checks.required, REQUIRED_RELEASE_CHECKS);
  assert.deepEqual(
    Object.keys(schema.properties.checks.properties),
    REQUIRED_RELEASE_CHECKS,
  );

  const checks = Object.fromEntries(
    REQUIRED_RELEASE_CHECKS.map((name) => [name, "pass"]),
  );
  const manifest = {
    schemaVersion: 2,
    repository: "https://github.com/cayankuzu/SoRita",
    commitSha: "a".repeat(40),
    ref: "main",
    treeState: "clean",
    generatedAt: "2026-08-31T00:00:00.000Z",
    release: {
      environment: "production",
      channel: "production",
      runtimeVersion: "1.0.102",
    },
    checks,
    artifacts: [
      { path: "artifacts/test.log", bytes: 5, sha256: "b".repeat(64) },
    ],
  };

  assert.equal(validateManifestSchema(manifest), manifest);
  assert.throws(
    () => validateManifestSchema({ ...manifest, unexpected: true }),
    /violates JSON Schema/u,
  );
  assert.throws(
    () => validateManifestSchema({ ...manifest, generatedAt: "not-a-date" }),
    /violates JSON Schema/u,
  );
});
