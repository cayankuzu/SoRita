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
const runtimeEvidenceVerifier = readFileSync(
  resolve(process.cwd(), "utils/release-evidence/runtime-evidence.mjs"),
  "utf8",
);
const easPreview = workflow("eas-update-preview.yml");
const easProduction = workflow("eas-update-production.yml");
const easProductionIos = workflow("eas-production-ios.yml");
const easProductionAndroidInternal = workflow(
  "eas-production-android-internal.yml",
);
const deploymentWorkflows = [
  cloudflarePreview,
  cloudflareProduction,
  easPreview,
  easProduction,
  easProductionAndroidInternal,
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
  // Four values from the reset history, plus the redaction test's fake JWT
  // fixture (8f9da5c). Each new entry is reviewed and counted here.
  assert.equal(reviewedFingerprints.length, 5);
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

test("Cloudflare credentials are scoped only to the steps that consume them", async () => {
  const { parse } = await import("yaml");
  const workflows = [
    {
      cleanupFile: "sorita-edge-preview-secrets.json",
      jobName: "deploy-preview",
      source: cloudflarePreview,
      secretBindings: {
        CLOUDFLARE_ACCOUNT_ID: {
          secretName: "CLOUDFLARE_ACCOUNT_ID",
          steps: [
            "Deploy preview from the verified lockfile",
            "Validate protected environment configuration",
          ],
        },
        CLOUDFLARE_API_TOKEN: {
          secretName: "CLOUDFLARE_API_TOKEN",
          steps: [
            "Deploy preview from the verified lockfile",
            "Validate protected environment configuration",
          ],
        },
        IP_HASH_PEPPER: {
          secretName: "CLOUDFLARE_IP_HASH_PEPPER",
          steps: [
            "Create a mode-600 transient Worker secret file",
            "Validate protected environment configuration",
          ],
        },
        ORIGIN_HMAC_SECRET: {
          secretName: "CLOUDFLARE_ORIGIN_HMAC_SECRET",
          steps: [
            "Create a mode-600 transient Worker secret file",
            "Validate protected environment configuration",
          ],
        },
        SUPABASE_PUBLISHABLE_KEY: {
          secretName: "CLOUDFLARE_SUPABASE_PUBLISHABLE_KEY",
          steps: [
            "Create a mode-600 transient Worker secret file",
            "Validate protected environment configuration",
          ],
        },
      },
    },
    {
      cleanupFile: "sorita-edge-production-secrets.json",
      jobName: "deploy-production-canary",
      source: cloudflareProduction,
      secretBindings: {
        CLOUDFLARE_ACCOUNT_ID: {
          secretName: "CLOUDFLARE_ACCOUNT_ID",
          steps: [
            "Automatically roll back a failed or cancelled canary",
            "Confirm the declared rollback version is currently deployed",
            "Route an initial 5% to the candidate",
            "Upload a production version without routing traffic",
            "Validate protected environment configuration",
          ],
        },
        CLOUDFLARE_API_TOKEN: {
          secretName: "CLOUDFLARE_API_TOKEN",
          steps: [
            "Automatically roll back a failed or cancelled canary",
            "Confirm the declared rollback version is currently deployed",
            "Route an initial 5% to the candidate",
            "Upload a production version without routing traffic",
            "Validate protected environment configuration",
          ],
        },
        IP_HASH_PEPPER: {
          secretName: "CLOUDFLARE_IP_HASH_PEPPER",
          steps: [
            "Create a mode-600 transient Worker secret file",
            "Validate protected environment configuration",
          ],
        },
        ORIGIN_HMAC_SECRET: {
          secretName: "CLOUDFLARE_ORIGIN_HMAC_SECRET",
          steps: [
            "Create a mode-600 transient Worker secret file",
            "Validate protected environment configuration",
          ],
        },
        SUPABASE_PUBLISHABLE_KEY: {
          secretName: "CLOUDFLARE_SUPABASE_PUBLISHABLE_KEY",
          steps: [
            "Create a mode-600 transient Worker secret file",
            "Validate protected environment configuration",
          ],
        },
      },
    },
  ];

  for (const definition of workflows) {
    const parsed = parse(definition.source, { uniqueKeys: true });
    const job = parsed.jobs[definition.jobName];
    assert.ok(job, `${definition.jobName} is missing`);
    assert.doesNotMatch(JSON.stringify(parsed.env ?? {}), /\$\{\{\s*secrets\./u);
    assert.doesNotMatch(JSON.stringify(job.env ?? {}), /\$\{\{\s*secrets\./u);

    for (const step of job.steps) {
      for (const [envName, value] of Object.entries(step.env ?? {})) {
        if (typeof value === "string" && /\$\{\{\s*secrets\./u.test(value)) {
          assert.ok(
            definition.secretBindings[envName],
            `${definition.jobName}/${step.name} exposes unexpected secret ${envName}`,
          );
        }
      }
    }

    for (const [envName, binding] of Object.entries(definition.secretBindings)) {
      const scopedSteps = job.steps.filter((step) =>
        Object.hasOwn(step.env ?? {}, envName),
      );
      assert.deepEqual(
        scopedSteps.map((step) => step.name).sort(),
        [...binding.steps].sort(),
        `${definition.jobName}/${envName} has the wrong step scope`,
      );
      for (const step of scopedSteps) {
        assert.equal(
          step.env[envName],
          "${{ secrets." + binding.secretName + " }}",
          `${definition.jobName}/${step.name} changed the source for ${envName}`,
        );
      }
    }

    const cleanupIndex = job.steps.findIndex(
      (step) => step.name === "Remove transient secret material",
    );
    const lastSecretFileConsumerIndex = job.steps.reduce(
      (lastIndex, step, index) =>
        Object.hasOwn(step.env ?? {}, "SECRETS_FILE") ? index : lastIndex,
      -1,
    );
    const cleanup = job.steps[cleanupIndex];
    assert.ok(cleanupIndex > lastSecretFileConsumerIndex);
    assert.equal(cleanup.if, "always()");
    assert.equal(
      cleanup.run,
      `rm -f -- "\${RUNNER_TEMP}/${definition.cleanupFile}"`,
    );
  }
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

test("signed mobile delivery requires successful same-SHA Quality and Database runs before build", async () => {
  const { parse } = await import("yaml");

  for (const [name, source] of [
    ["Android Internal", easProductionAndroidInternal],
    ["iOS TestFlight", easProductionIos],
  ]) {
    const parsedWorkflow = parse(source, { uniqueKeys: true });
    const inputs = parsedWorkflow.on.workflow_dispatch.inputs;
    assert.deepEqual(parsedWorkflow.permissions, {
      actions: "read",
      contents: "read",
    });
    assert.deepEqual(
      {
        databaseRun: inputs.database_run_id,
        qualityRun: inputs.quality_run_id,
      },
      {
        databaseRun: {
          description: "Successful Database Validation workflow run ID for candidate_sha",
          required: true,
          type: "string",
        },
        qualityRun: {
          description: "Successful Quality workflow run ID for candidate_sha",
          required: true,
          type: "string",
        },
      },
    );
    assert.match(source, /quality_run_id:/u, `${name} must require a Quality run ID`);
    assert.match(
      source,
      /database_run_id:/u,
      `${name} must require a Database Validation run ID`,
    );
    assert.match(source, /permissions:\s*\n\s+actions: read/u);
    assert.match(source, /verify_and_record\(\)/u);
    assert.ok(source.includes('[[ ! "$run_id" =~ ^[0-9]+$ ]]'));
    assert.ok(source.includes("actions/runs/${run_id}"));
    assert.ok(source.includes("actions/workflows/${workflow_file}"));
    assert.match(source, /\.workflow_id\|tostring/u);
    assert.match(source, /\.head_repository\.full_name/u);
    assert.match(source, /\.repository\.full_name/u);
    assert.ok(source.includes('"$status" != completed'));
    assert.ok(source.includes('"$conclusion" != success'));
    assert.ok(source.includes('"${head_sha,,}" != "${CANDIDATE_SHA,,}"'));
    assert.ok(source.includes('"$workflow_id" != "$expected_id"'));
    assert.ok(source.includes('"$head_repository" != "$GITHUB_REPOSITORY"'));
    assert.ok(source.includes('"$repository" != "$GITHUB_REPOSITORY"'));
    assert.match(
      source,
      /verify_and_record "\$QUALITY_RUN_ID" quality\.yml quality-run\.json/u,
    );
    assert.match(
      source,
      /verify_and_record "\$DATABASE_RUN_ID" database-validation\.yml database-run\.json/u,
    );
    assert.match(source, /prerequisiteRuns/u);

    const evidenceGateIndex = source.indexOf(
      "Verify successful same-SHA Quality and Database Validation runs",
    );
    const easSetupIndex = source.indexOf("Set up pinned EAS CLI");
    const buildIndex = source.indexOf("eas build \\");
    assert.ok(evidenceGateIndex >= 0, `${name} is missing its prerequisite evidence gate`);
    assert.ok(
      evidenceGateIndex < easSetupIndex,
      `${name} must verify prerequisite evidence before exposing EAS credentials`,
    );
    assert.ok(
      evidenceGateIndex < buildIndex,
      `${name} must verify prerequisite evidence before EAS Build`,
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

test("runtime evidence verifies protected Ed25519 attestations without exposing a private key", async () => {
  const { parse } = await import("yaml");
  const runtimeWorkflow = parse(runtimeEvidence, { uniqueKeys: true });
  const releaseWorkflow = parse(releaseEvidence, { uniqueKeys: true });
  const runtimeJob = runtimeWorkflow.jobs["seal-runtime-evidence"];
  const runtimeVerificationStep = runtimeJob.steps.find(
    (step) => step.name === "Verify and canonicalize signed machine probe receipts",
  );
  const releaseJob = releaseWorkflow.jobs["repository-evidence"];
  const releaseVerificationStep = releaseJob.steps.find(
    (step) => step.name === "Download and verify exact provider and device runtime evidence",
  );

  assert.match(
    runtimeEvidence,
    /runs-on: \[self-hosted, macOS, sorita-runtime-evidence\]/u,
  );
  assert.match(runtimeEvidence, /environment: production-evidence/u);
  assert.equal(releaseJob.environment, "production-evidence");
  assert.ok(runtimeVerificationStep);
  assert.ok(releaseVerificationStep);
  assert.equal(
    runtimeVerificationStep.env.RUNTIME_EVIDENCE_SOURCE_ROOT,
    "${{ vars.RUNTIME_EVIDENCE_SOURCE_ROOT }}",
  );
  for (const step of [runtimeVerificationStep, releaseVerificationStep]) {
    assert.equal(
      step.env.RUNTIME_EVIDENCE_ED25519_PUBLIC_KEY_SPKI_BASE64,
      "${{ vars.RUNTIME_EVIDENCE_ED25519_PUBLIC_KEY_SPKI_BASE64 }}",
    );
    assert.equal(
      step.env.RUNTIME_EVIDENCE_EXPECTED_KEY_ID,
      "${{ vars.RUNTIME_EVIDENCE_EXPECTED_KEY_ID }}",
    );
    assert.match(step.run, /--public-key-spki-base64/u);
    assert.match(step.run, /--key-id/u);
  }
  assert.doesNotMatch(JSON.stringify(runtimeWorkflow.env ?? {}), /RUNTIME_EVIDENCE_/u);
  assert.doesNotMatch(JSON.stringify(runtimeJob.env ?? {}), /RUNTIME_EVIDENCE_/u);
  for (const source of [runtimeEvidence, releaseEvidence]) {
    assert.doesNotMatch(source, /RUNTIME_EVIDENCE_(?:ED25519_)?PRIVATE/u);
    assert.doesNotMatch(source, /secrets\.RUNTIME_EVIDENCE/u);
  }
  assert.doesNotMatch(
    runtimeEvidenceVerifier,
    /createPrivateKey|generateKeyPair|\bprivateKey\b|\bsign\s*\(/u,
  );
  assert.match(runtimeEvidence, /runtime-evidence\.mjs stage/u);
  assert.match(runtimeEvidence, /runtime-evidence\.mjs verify/u);
  assert.match(runtimeEvidence, /must have read-only access to the signed receipt directory/u);
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
  for (const source of [
    cloudflareProduction,
    easProduction,
    easProductionAndroidInternal,
    easProductionIos,
    releaseEvidence,
  ]) {
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

test("every workflow file parses, so a bad edit cannot fail with zero logs", async () => {
  // A workflow with a duplicate key does not fail a job; GitHub refuses to
  // create any job at all, producing a 0-second red run with no logs to read.
  // The other assertions in this file read workflows as text and would not
  // notice. Parsing them here does.
  const { readdirSync } = await import("node:fs");
  const yaml = await import("yaml");
  const directory = resolve(process.cwd(), ".github/workflows");
  const files = readdirSync(directory).filter((name) => name.endsWith(".yml"));

  assert.ok(files.length > 0, "expected workflow files to exist");

  for (const file of files) {
    const source = workflow(file);
    let parsed;
    assert.doesNotThrow(() => {
      // uniqueKeys defaults to true, which is what catches duplicates.
      parsed = yaml.parse(source, { uniqueKeys: true });
    }, `${file} is not valid YAML`);
    assert.ok(parsed?.jobs, `${file} declares no jobs`);
    for (const [id, job] of Object.entries(parsed.jobs)) {
      assert.ok(
        Array.isArray(job.steps) || job.uses,
        `${file} job ${id} has neither steps nor a reusable workflow`,
      );
    }
  }
});
