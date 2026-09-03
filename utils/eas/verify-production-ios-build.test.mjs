import assert from "node:assert/strict";
import test from "node:test";

import { verifyProductionIosBuild } from "./verify-production-ios-build.mjs";

const sourceSha = "a".repeat(40);
const runtimeVersion = "1.0.102";
const projectId = "b4a62a22-92dd-4867-ab44-f9131d958ed2";
const buildId = "22222222-2222-4222-8222-222222222222";
const bundleId = "com.cayan.sorita.socialmap";

function validBuild(overrides = {}) {
  return {
    app: { id: projectId },
    appBuildVersion: "87",
    appIdentifier: bundleId,
    appVersion: runtimeVersion,
    artifacts: {
      applicationArchiveUrl: "https://provider.example/application.ipa",
    },
    buildProfile: "production",
    distribution: "STORE",
    gitCommitHash: sourceSha,
    id: buildId,
    platform: "IOS",
    status: "FINISHED",
    updateChannel: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "production",
    },
    ...overrides,
  };
}

function verify(build) {
  return verifyProductionIosBuild({
    build,
    buildId,
    bundleId,
    projectId,
    runtimeVersion,
    sourceSha,
  });
}

test("accepts only the exact provider store build and strips the artifact URL", () => {
  const result = verify(validBuild());
  assert.equal(result.gitCommitHash, sourceSha);
  assert.equal(result.updateChannel, "production");
  assert.equal(JSON.stringify(result).includes("provider.example"), false);
});

test("rejects a build from another source, identity, profile or channel", () => {
  assert.throws(
    () => verify(validBuild({ gitCommitHash: "b".repeat(40) })),
    /source SHA/u,
  );
  assert.throws(
    () => verify(validBuild({ appIdentifier: "com.example.other" })),
    /bundle/u,
  );
  assert.throws(
    () => verify(validBuild({ buildProfile: "preview" })),
    /profile/u,
  );
  assert.throws(
    () =>
      verify(validBuild({ updateChannel: { id: "ignored", name: "preview" } })),
    /channel/u,
  );
});

test("rejects unfinished builds and missing provider artifacts", () => {
  assert.throws(
    () => verify(validBuild({ status: "IN_PROGRESS" })),
    /not finished/u,
  );
  assert.throws(
    () => verify(validBuild({ artifacts: {} })),
    /provider artifact/u,
  );
});
