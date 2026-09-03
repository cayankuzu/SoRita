#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value || value.startsWith("--")) {
      fail(`Invalid or missing value for ${name ?? "argument"}.`);
    }
    options[name.slice(2)] = value;
  }
  const required = [
    "build-id",
    "build-json",
    "bundle-id",
    "output",
    "project-id",
    "runtime",
    "source",
  ];
  const missing = required.filter((name) => !options[name]);
  if (missing.length > 0) fail(`Missing options: ${missing.join(", ")}.`);
  return options;
}

export function verifyProductionIosBuild({
  build,
  buildId,
  bundleId,
  projectId,
  runtimeVersion,
  sourceSha,
}) {
  if (!build || typeof build !== "object" || Array.isArray(build)) {
    fail("EAS build response must be an object.");
  }
  if (!UUID_PATTERN.test(buildId) || !UUID_PATTERN.test(projectId)) {
    fail("Build and project IDs must be UUIDs.");
  }
  if (!SHA_PATTERN.test(sourceSha) || !VERSION_PATTERN.test(runtimeVersion)) {
    fail("Source SHA or runtime version is invalid.");
  }
  if (build.id !== buildId)
    fail("EAS build ID does not match the scheduled build.");
  if (build.status !== "FINISHED") fail("EAS build is not finished.");
  if (build.platform !== "IOS") fail("EAS build platform is not iOS.");
  if (build.distribution !== "STORE") fail("EAS build is not a store build.");
  if (build.buildProfile !== "production")
    fail("EAS build profile is not production.");
  if (build.gitCommitHash?.toLowerCase() !== sourceSha)
    fail("EAS build source SHA does not match.");
  if (build.appVersion !== runtimeVersion)
    fail("EAS build runtime version does not match.");
  if (build.appIdentifier !== bundleId)
    fail("EAS build bundle identifier does not match.");
  if (build.app?.id !== projectId) fail("EAS build project does not match.");
  if ((build.updateChannel?.name ?? build.channel) !== "production") {
    fail("EAS build update channel is not production.");
  }
  if (!/^\d+$/u.test(build.appBuildVersion ?? ""))
    fail("EAS build number is invalid.");
  const artifactUrl =
    build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;
  if (typeof artifactUrl !== "string" || !artifactUrl.startsWith("https://")) {
    fail("EAS build has no provider artifact.");
  }

  return {
    appBuildVersion: build.appBuildVersion,
    appIdentifier: build.appIdentifier,
    appVersion: build.appVersion,
    buildProfile: build.buildProfile,
    distribution: build.distribution,
    gitCommitHash: build.gitCommitHash.toLowerCase(),
    id: build.id,
    platform: build.platform,
    projectId: build.app.id,
    schemaVersion: 1,
    status: build.status,
    updateChannel: "production",
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = verifyProductionIosBuild({
    build: JSON.parse(readFileSync(resolve(options["build-json"]), "utf8")),
    buildId: options["build-id"],
    bundleId: options["bundle-id"],
    projectId: options["project-id"],
    runtimeVersion: options.runtime,
    sourceSha: options.source,
  });
  const outputPath = resolve(options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
