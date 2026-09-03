import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const previewWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/eas-update-preview.yml"),
  "utf8",
);
const productionWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/eas-update-production.yml"),
  "utf8",
);

function assertOrdered(workflow, markers) {
  let previousIndex = -1;

  for (const marker of markers) {
    const index = workflow.indexOf(marker);
    assert.ok(
      index > previousIndex,
      `${marker} must appear after the preceding gate`,
    );
    previousIndex = index;
  }
}

test("preview publishing is manual, isolated, pinned, and quality-gated", () => {
  assert.match(previewWorkflow, /^on:\s*\n\s+workflow_dispatch:/mu);
  assert.match(previewWorkflow, /^permissions:\s*\n\s+contents: read$/mu);
  assert.match(previewWorkflow, /environment: preview/u);
  assert.match(previewWorkflow, /eas build:view "\$android_build_id" --json/u);
  assert.match(previewWorkflow, /utils\/eas\/verify-build-evidence\.mjs/u);
  assert.match(previewWorkflow, /utils\/eas\/check-update-code-signing\.mjs/u);
  assert.match(previewWorkflow, /actions\/checkout@[0-9a-f]{40} # v7\.0\.0/u);
  assert.match(previewWorkflow, /actions\/setup-node@[0-9a-f]{40} # v7\.0\.0/u);
  assert.match(
    previewWorkflow,
    /expo\/expo-github-action@[0-9a-f]{40} # v9\.0\.0/u,
  );
  assert.match(previewWorkflow, /eas-version: 23\.0\.0/u);
  assert.match(previewWorkflow, /--channel preview/u);
  assert.match(previewWorkflow, /--environment preview/u);
  assert.doesNotMatch(previewWorkflow, /eas-version: latest/u);
  assertOrdered(previewWorkflow, [
    "Verify source and OTA-enabled preview binaries",
    "Classify the commit range",
    "Run the complete release quality gate",
    "Require a valid tracked OTA code-signing certificate",
    "Publish to the isolated preview channel",
  ]);
});

test("production requires protected evidence for the exact previewed SHA", () => {
  assert.match(productionWorkflow, /^on:\s*\n\s+workflow_dispatch:/mu);
  assert.match(productionWorkflow, /^\s+actions: read$/mu);
  assert.match(productionWorkflow, /^\s+contents: read$/mu);
  assert.match(productionWorkflow, /environment: production/u);
  assert.match(
    productionWorkflow,
    /eas build:view "\$android_build_id" --json/u,
  );
  assert.match(productionWorkflow, /utils\/eas\/verify-build-evidence\.mjs/u);
  assert.match(
    productionWorkflow,
    /utils\/eas\/check-update-code-signing\.mjs/u,
  );
  assert.match(productionWorkflow, /release_evidence_run_id:/u);
  assert.match(productionWorkflow, /evidence_sha.*TARGET_SHA/u);
  assert.match(
    productionWorkflow,
    /verify_run "\$PREVIEW_RUN_ID" eas-update-preview\.yml workflow_dispatch/u,
  );
  assert.match(productionWorkflow, /quality\.yml/u);
  assert.match(productionWorkflow, /database-validation\.yml/u);
  assert.match(productionWorkflow, /runtime=.*source=.*BASE_SHA/u);
  assert.match(productionWorkflow, /final-release-evidence-\$\{TARGET_SHA\}/u);
  assert.match(
    productionWorkflow,
    /npm run release-evidence:verify -- --manifest/u,
  );
  assert.match(
    productionWorkflow,
    /manifest\.release\?\.environment !== 'production'/u,
  );
  assert.match(
    productionWorkflow,
    /manifest\.release\?\.channel !== 'production'/u,
  );
  assert.match(
    productionWorkflow,
    /manifest\.release\?\.runtimeVersion !== process\.env\.EXPECTED_RUNTIME_VERSION/u,
  );
  assertOrdered(productionWorkflow, [
    "Verify source, approval, and OTA-enabled store binaries",
    "Verify successful preview and CI gates for the same SHA",
    "Download and verify the exact release evidence packet",
    "Classify the commit range",
    "Re-run the complete release quality gate",
    "Require a valid tracked OTA code-signing certificate",
    "Publish an initial 5% production rollout",
  ]);
});

test("production uses staged rollout controls and automatically stops a failed canary", () => {
  assert.match(productionWorkflow, /--channel production/u);
  assert.match(productionWorkflow, /--environment production/u);
  assert.match(productionWorkflow, /--rollout-percentage 5/u);
  assert.match(productionWorkflow, /--rollout-percentage 20/u);
  assert.match(productionWorkflow, /--rollout-percentage 50/u);
  assert.match(productionWorkflow, /--rollout-percentage 100/u);
  assert.match(
    productionWorkflow,
    /does not automatically advance later stages/u,
  );
  assert.match(productionWorkflow, /update:revert-update-rollout --group/u);
  assert.match(
    productionWorkflow,
    /Automatically stop a failed or cancelled production rollout/u,
  );
});
