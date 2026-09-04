import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function workflow(name) {
  return readFileSync(
    resolve(process.cwd(), ".github/workflows", name),
    "utf8",
  );
}

const quality = workflow("quality.yml");
const gitleaksIgnore = readFileSync(
  resolve(process.cwd(), ".gitleaksignore"),
  "utf8",
);
const database = workflow("database-validation.yml");
const dockerValidation = workflow("docker-validation.yml");
const cloudflarePreview = workflow("cloudflare-preview.yml");
const cloudflareProduction = workflow("cloudflare-production.yml");
const releaseEvidence = workflow("release-evidence.yml");
const runtimeEvidence = workflow("runtime-evidence.yml");
const easPreview = workflow("eas-update-preview.yml");
const easProduction = workflow("eas-update-production.yml");
const easProductionIos = workflow("eas-production-ios.yml");
const deploymentWorkflows = [
  cloudflarePreview,
  cloudflareProduction,
  easPreview,
  easProduction,
  easProductionIos,
  releaseEvidence,
  runtimeEvidence,
];

test("quality runs release, Worker, SAST and full-history secret gates", () => {
  assert.match(quality, /npm run check:release/u);
  assert.match(quality, /infra\/cloudflare\/sorita-edge/u);
  assert.match(quality, /semgrep scan/u);
  assert.match(quality, /gitleaks\/gitleaks:v8\.29\.0@sha256:[0-9a-f]{64}/u);
  assert.match(quality, /--gitleaks-ignore-path=\/repo\/\.gitleaksignore/u);
  assert.match(quality, /--log-opts="--all"/u);

  const reviewedFingerprints = gitleaksIgnore
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  assert.equal(reviewedFingerprints.length, 4);
  for (const fingerprint of reviewedFingerprints) {
    assert.match(fingerprint, /^[0-9a-f]{40}:[^:]+:[a-z0-9-]+:\d+$/u);
  }
});

test("database workflow replays, tests, lints and restores migrations", () => {
  for (const marker of [
    "supabase start",
    "supabase db reset --local",
    "supabase db lint --local --level error",
    "supabase test db --local",
    "pg_dump",
    "pg_restore",
  ]) {
    assert.match(database, new RegExp(marker.replaceAll(" ", "\\s+"), "u"));
  }
  assert.match(database, /supabase\/setup-cli@[0-9a-f]{40}/u);
  assert.match(database, /name: database-evidence-\$\{\{ github\.sha \}\}/u);
  assert.match(database, /\$\{directory\}\/manifest\.json/u);
  assert.match(database, /actions\/upload-artifact@[0-9a-f]{40}/u);
});

test("Docker workflow builds, tests, scans and emits checksum-bound same-SHA evidence", () => {
  for (const marker of [
    "docker:config",
    "docker:test",
    "docker:resilience",
    "docker:load",
    "hadolint/hadolint-action@",
    "aquasecurity/trivy-action@",
    "anchore/sbom-action@",
    "docker-evidence-${{ github.sha }}",
  ]) {
    assert.ok(
      dockerValidation.includes(marker),
      `Docker workflow is missing ${marker}`,
    );
  }
  assert.match(
    dockerValidation,
    /org\.opencontainers\.image\.revision=\$\{GITHUB_SHA\}/u,
  );
  assert.match(dockerValidation, /--provenance=mode=max/u);
  assert.match(dockerValidation, /--sbom=true/u);
  assert.match(dockerValidation, /extract-buildkit-attestations\.mjs/u);
  assert.match(dockerValidation, /record-image-build-evidence\.mjs/u);
  assert.match(dockerValidation, /SORITA_DOCKER_REUSE_IMAGE: '1'/u);
  assert.doesNotMatch(dockerValidation, /--provenance=false/u);
  assert.match(dockerValidation, /TARGET_SHA: \$\{\{ github\.sha \}\}/u);
  assert.match(
    dockerValidation,
    /docker\/setup-buildx-action@[0-9a-f]{40}/u,
    "attested builds need a pinned Buildx setup action",
  );
  assert.match(
    dockerValidation,
    /driver:\s*docker-container/u,
    "the default docker driver cannot produce attestations",
  );
  assert.match(
    dockerValidation,
    /docker buildx inspect --bootstrap/u,
    "the resolved builder driver must be verified before building",
  );
});

test("preview Worker deployment is protected, strict and deletes transient secrets", () => {
  assert.match(cloudflarePreview, /environment: preview/u);
  assert.match(cloudflarePreview, /inputs\.deploy_preview/u);
  assert.match(cloudflarePreview, /--strict/u);
  assert.match(cloudflarePreview, /--secrets-file/u);
  assert.match(
    cloudflarePreview,
    /rm -f -- .*sorita-edge-preview-secrets\.json/u,
  );
  assert.match(cloudflarePreview, /health response must be no-store/u);
  assert.match(cloudflarePreview, /--var "BUILD_SHA:\$\{GITHUB_SHA\}"/u);
  assert.match(cloudflarePreview, /body\?\.buildSha !== expectedSha/u);
});

test("production Worker deploy requires same-SHA gates and only starts a 5% canary", () => {
  assert.match(cloudflareProduction, /environment: production/u);
  assert.match(cloudflareProduction, /quality\.yml/u);
  assert.match(cloudflareProduction, /database-validation\.yml/u);
  assert.match(cloudflareProduction, /cloudflare-preview\.yml/u);
  assert.match(cloudflareProduction, /head_sha.*TARGET_SHA/u);
  assert.match(
    cloudflareProduction,
    /actions\/runs\/\$\{PREVIEW_RUN_ID\}\/jobs/u,
  );
  assert.match(cloudflareProduction, /Deploy protected preview Worker/u);
  assert.match(cloudflareProduction, /completed\\tsuccess/u);
  assert.match(cloudflareProduction, /--var "BUILD_SHA:\$\{GITHUB_SHA\}"/u);
  assert.match(cloudflareProduction, /Cloudflare-Workers-Version-Overrides/u);
  assert.match(cloudflareProduction, /body\?\.buildSha !== expectedSha/u);
  assert.match(cloudflareProduction, /attempt <= 12/u);
  assert.match(cloudflareProduction, /@95%/u);
  assert.match(cloudflareProduction, /@5%/u);
  assert.match(cloudflareProduction, /@25%/u);
  assert.match(cloudflareProduction, /@50%/u);
  assert.match(cloudflareProduction, /@100%/u);
  assert.match(cloudflareProduction, /Rollback:/u);
  assert.match(
    cloudflareProduction,
    /EDGE_CORS_ALLOWLIST still contains a placeholder origin/u,
    "production must reject placeholder CORS origins before uploading a version",
  );
  assert.match(
    cloudflareProduction,
    /EDGE_CORS_ALLOWLIST entries must be https origins/u,
  );
  assert.match(
    cloudflareProduction,
    /EDGE_CORS_ALLOWLIST must list at least one origin/u,
  );
});

test("production deploys consume one exact same-run release evidence artifact before mutation", () => {
  for (const [name, source, mutationMarker] of [
    [
      "Cloudflare",
      cloudflareProduction,
      "Upload a production version without routing traffic",
    ],
    ["EAS", easProduction, "Publish an initial 5% production rollout"],
  ]) {
    assert.match(
      source,
      /release_evidence_run_id:/u,
      `${name} must require an evidence run ID`,
    );
    assert.match(source, /actions\/workflows\/release-evidence\.yml/u);
    assert.match(source, /event_name" != workflow_dispatch/u);
    assert.match(source, /head_repository" != "\$GITHUB_REPOSITORY"/u);
    assert.match(source, /repository" != "\$GITHUB_REPOSITORY"/u);
    assert.match(
      source,
      /artifact_name="final-release-evidence-\$\{TARGET_SHA\}"/u,
    );
    assert.match(source, /matches\.length !== 1/u);
    assert.match(source, /artifact\.workflow_run\?\.id/u);
    assert.match(source, /artifact\.workflow_run\?\.head_sha/u);
    assert.match(source, /\^sha256:\[a-f0-9\]\{64\}\$/u);
    assert.match(source, /actions\/artifacts\/\$\{artifact_id\}\/zip/u);
    assert.match(source, /actual_digest="sha256:/u);
    assert.match(source, /actual_digest" != "\$expected_digest/u);
    assert.match(source, /unzip -q "\$archive_file"/u);
    assert.match(source, /git status --porcelain=v1 --untracked-files=all/u);
    assert.match(
      source,
      /npm run release-evidence:verify -- --manifest "\$RELEASE_MANIFEST"/u,
    );
    assert.match(source, /nonPassingChecks/u);
    assert.match(source, /state !== 'pass'/u);
    assert.match(source, /manifest\.commitSha !== process\.env\.TARGET_SHA/u);
    assert.match(source, /manifest\.release\?\.environment !== 'production'/u);
    assert.match(source, /manifest\.release\?\.channel !== 'production'/u);
    assert.match(
      source,
      /manifest\.release\?\.runtimeVersion !== process\.env\.EXPECTED_RUNTIME_VERSION/u,
    );
    const cleanCheckoutIndex = source.indexOf(
      "git status --porcelain=v1 --untracked-files=all",
    );
    const downloadIndex = source.indexOf(
      "actions/artifacts/${artifact_id}/zip",
    );
    const verifierIndex = source.indexOf("npm run release-evidence:verify");
    assert.ok(
      cleanCheckoutIndex < downloadIndex,
      `${name} must prove a clean checkout before download`,
    );
    assert.ok(
      downloadIndex < verifierIndex,
      `${name} must download the selected artifact before verifying it`,
    );
    assert.ok(
      verifierIndex < source.indexOf(mutationMarker),
      `${name} must verify release evidence before its first production mutation`,
    );
  }
});

test("release evidence supports partial NO-GO and a checksum-bound final runtime path", () => {
  assert.match(releaseEvidence, /candidate_sha/u);
  assert.match(releaseEvidence, /WORKFLOW_SHA: \$\{\{ github\.sha \}\}/u);
  assert.ok(
    releaseEvidence.includes('${CANDIDATE_SHA,,}" != "${WORKFLOW_SHA,,}'),
  );
  assert.match(
    releaseEvidence,
    /runtime_version must match the immutable candidate package version/u,
  );
  assert.match(releaseEvidence, /quality\.yml/u);
  assert.match(releaseEvidence, /database-validation\.yml/u);
  assert.match(releaseEvidence, /docker-validation\.yml/u);
  assert.match(releaseEvidence, /docker_run_id/u);
  assert.match(releaseEvidence, /database-evidence-\$\{CANDIDATE_SHA\}/u);
  assert.match(releaseEvidence, /docker-evidence-\$\{CANDIDATE_SHA\}/u);
  assert.match(releaseEvidence, /Artifact digest mismatch/u);
  assert.match(releaseEvidence, /Inner artifact checksum mismatch/u);
  assert.match(releaseEvidence, /docker-validation=pass/u);
  assert.match(releaseEvidence, /signed-android-ios=unverified/u);
  assert.match(releaseEvidence, /ota-code-signing=unverified/u);
  assert.match(releaseEvidence, /physical-device-matrix=unverified/u);
  assert.match(releaseEvidence, /runtime_evidence_run_id/u);
  assert.match(releaseEvidence, /actions\/workflows\/runtime-evidence\.yml/u);
  assert.match(releaseEvidence, /runtime-evidence-\$\{CANDIDATE_SHA\}/u);
  assert.match(releaseEvidence, /Runtime evidence artifact digest mismatch/u);
  assert.match(releaseEvidence, /runtime-evidence\.mjs verify/u);
  assert.match(releaseEvidence, /physical-device-matrix=pass/u);
  assert.match(releaseEvidence, /provider-dashboards=pass/u);
  assert.match(
    releaseEvidence,
    /name: final-release-evidence-\$\{\{ inputs\.candidate_sha \}\}/u,
  );
  assert.match(releaseEvidence, /manifest\.mjs create/u);
  assert.match(
    releaseEvidence,
    /incomplete evidence manifest was accepted unexpectedly/iu,
  );
  assert.match(
    releaseEvidence,
    /name: partial-release-evidence-\$\{\{ inputs\.candidate_sha \}\}/u,
  );
});

test("runtime evidence is sealed only by a protected self-hosted probe runner", () => {
  assert.match(
    runtimeEvidence,
    /runs-on: \[self-hosted, macOS, sorita-runtime-evidence\]/u,
  );
  assert.match(runtimeEvidence, /environment: production-evidence/u);
  assert.match(
    runtimeEvidence,
    /RUNTIME_EVIDENCE_SOURCE_ROOT: \$\{\{ vars\.RUNTIME_EVIDENCE_SOURCE_ROOT \}\}/u,
  );
  assert.match(runtimeEvidence, /runtime-evidence\.mjs stage/u);
  assert.match(runtimeEvidence, /runtime-evidence\.mjs verify/u);
  assert.doesNotMatch(runtimeEvidence, /^\s{6}(?:result|status|pass):/mu);
  assert.match(
    runtimeEvidence,
    /name: runtime-evidence-\$\{\{ inputs\.candidate_sha \}\}/u,
  );
});

test("deployment workflows avoid privileged PR triggers and mobile service-role material", () => {
  for (const source of deploymentWorkflows) {
    assert.doesNotMatch(source, /pull_request_target/u);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE/u);
    for (const match of source.matchAll(
      /uses:\s+(actions\/(?:checkout|setup-node|upload-artifact)|expo\/expo-github-action)@([^\s]+)/gu,
    )) {
      assert.match(
        match[2],
        /^[0-9a-f]{40}$/u,
        `${match[1]} must be SHA-pinned`,
      );
    }
  }
});

test("production and release-evidence workflows never execute Docker workloads", () => {
  for (const source of [cloudflareProduction, easProduction, releaseEvidence]) {
    assert.doesNotMatch(source, /\bdocker\s+(?:build|buildx|compose|run)\b/iu);
  }
});

test("CI aggregates every required gate and treats a skip as not green", () => {
  const ci = workflow("ci.yml");
  const ciNeeds = ci
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
  assert.match(ci, /release-gates:/u, "CI must expose a final aggregator job");
  assert.match(ci, /if: always\(\)/u, "the aggregator must run even when a gate fails");
  assert.match(ci, /RELEASE_GATES_GREEN/u);
  for (const job of [
    "database-security",
    "security-supply-chain",
    "lint-and-typecheck",
    "test",
    "build-android",
    "build-ios",
    "android-device-performance",
  ]) {
    assert.ok(
      ciNeeds.includes(job),
      `aggregator must require ${job}`,
    );
  }
  // A skipped required job must never be accepted as a pass.
  assert.match(ci, /expected 'success'/u);
});
