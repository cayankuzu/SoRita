import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  checkRepository,
  validateEasCredentialPortability,
} from "../check-eas-credential-portability.mjs";

function repositoryInputs() {
  const root = process.cwd();
  return {
    appConfig: readFileSync(resolve(root, "app.config.ts"), "utf8"),
    easConfig: JSON.parse(readFileSync(resolve(root, "eas.json"), "utf8")),
    easIgnore: readFileSync(resolve(root, ".easignore"), "utf8"),
    gitIgnore: readFileSync(resolve(root, ".gitignore"), "utf8"),
    workflow: readFileSync(
      resolve(root, ".github/workflows/eas-production-ios.yml"),
      "utf8",
    ),
  };
}

test("repository uses remote build credentials and ephemeral protected submit material", () => {
  assert.deepEqual(checkRepository(), {
    buildCredentialSource: "remote",
    bundleIdentifier: "com.cayan.sorita.socialmap",
    ephemeralSubmitCredential: true,
    productionTrigger: "workflow_dispatch",
  });
});

test("rejects a tracked ASC key path or a local production credential source", () => {
  const localPath = repositoryInputs();
  localPath.easConfig = structuredClone(localPath.easConfig);
  localPath.easConfig.build.production.credentialsSource = "local";
  localPath.easConfig.submit.production.ios.ascApiKeyPath =
    "./AuthKey_EXAMPLE01.p8";
  assert.throws(
    () => validateEasCredentialPortability(localPath),
    /credentialsSource must be remote[\s\S]*private credential paths are forbidden/u,
  );
});

test("rejects PR-triggered production submission and credential artifact upload", () => {
  const unsafeWorkflow = repositoryInputs();
  unsafeWorkflow.workflow = unsafeWorkflow.workflow
    .replace("  workflow_dispatch:", "  pull_request:")
    .replace(
      "path: ${{ runner.temp }}/eas-production-ios-testflight-receipt.json",
      "path: ${{ runner.temp }}/sorita-eas-submit/AuthKey.p8",
    );
  assert.throws(
    () => validateEasCredentialPortability(unsafeWorkflow),
    /cannot run from a pull request[\s\S]*must not be included in uploaded artifacts/u,
  );
});
